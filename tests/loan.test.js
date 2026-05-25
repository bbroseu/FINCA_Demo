const request = require('supertest');
const { setAspektResponse, resetAspektMock } = require('./helpers/aspektMock');

const makeApp = require('./helpers/app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUserWithToken, bearer } = require('./helpers/auth');

let app;
let staff;

const ALIAS = '1403990450033';
const LOAN = '01150000013-01-0088251-00002';

beforeAll(() => { app = makeApp(); });
beforeEach(async () => {
  await resetDb();
  resetAspektMock();
  staff = await createUserWithToken({ email: 's@test.com' });
});
afterAll(async () => { await closeDb(); });

function mockActiveLoansOk(loans = [{ LoanNumber: LOAN, Product: 'P', ProductType: 'T', Amount: 100, DisbursementDate: '01.01.2024' }]) {
  setAspektResponse('GET', '/api/getActiveLoans/', {
    status: 200,
    data: { Code: 200, Body: { ActiveLoans: { Loans: loans } } },
  });
}

describe('GET /api/loan/details/:alias/:loanNumber', () => {
  test('401 without token', async () => {
    expect((await request(app).get(`/api/loan/details/${ALIAS}/${LOAN}`)).status).toBe(401);
  });

  test('returns consolidated details on happy path', async () => {
    mockActiveLoansOk();
    setAspektResponse('GET', '/api/getLoan/', {
      status: 200,
      data: { Body: {
        LoanNumber: LOAN, Amount: 100, NumberOfInstallments: 12, RemainingAmount: 80,
        RemainingInstallments: 9, TotalPastDueAmount: 0, NextInstallmentAmount: 10,
        NextInstallmentDate: '01.02.2024', TotalToCloseAmount: 90, MaturityDate: '01.01.2025',
        Product: 'P', LoanStatus: 'Active', LoanStatusCode: 'A',
      } },
    });
    setAspektResponse('GET', '/api/repaymentPlan/', {
      status: 200,
      data: { Body: [{ RepaymentPlan: [{
        Installment: 1, DateFrom: '01.01.2024', DateTo: '01.02.2024', LastRepaymentDate: '15.01.2024',
        InstallmentAmount: 10, Principal: 8, Interest: 2, Balance: 92,
      }] }] },
    });
    const res = await request(app).get(`/api/loan/details/${ALIAS}/${LOAN}`).set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.data.loanNumber).toBe(LOAN);
    expect(res.body.data.repaymentPlan).toHaveLength(1);
    expect(res.body.data.repaymentPlan[0].isPaid).toBe(true);
  });

  // The original bug: Aspekt returned Code 402 with no Body.ActiveLoans →
  // service threw → 500. After fix this returns a clean 404.
  test('Code 402 (person does not exist) → 404 (was 500 before the fix)', async () => {
    setAspektResponse('GET', '/api/getActiveLoans/', { status: 200, data: { Code: 402, Msg: 'Person does not exist' } });
    const res = await request(app).get(`/api/loan/details/${ALIAS}/${LOAN}`).set(bearer(staff.token));
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Person does not exist/);
  });

  test('loan not in active list → 403 (default mapping in route)', async () => {
    mockActiveLoansOk([{ LoanNumber: 'other' }]);
    const res = await request(app).get(`/api/loan/details/${ALIAS}/${LOAN}`).set(bearer(staff.token));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/loan/active/:alias', () => {
  test('200 with normalized loan list', async () => {
    mockActiveLoansOk();
    const res = await request(app).get(`/api/loan/active/${ALIAS}`).set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.data.loans[0]).toMatchObject({ loanNumber: LOAN, product: 'P' });
  });

  test('Code 402 → 404', async () => {
    setAspektResponse('GET', '/api/getActiveLoans/', { status: 200, data: { Code: 402, Msg: 'no person' } });
    expect((await request(app).get(`/api/loan/active/${ALIAS}`).set(bearer(staff.token))).status).toBe(404);
  });

  test('Code 420 → 404', async () => {
    setAspektResponse('GET', '/api/getActiveLoans/', { status: 200, data: { Code: 420, Msg: 'no loans' } });
    expect((await request(app).get(`/api/loan/active/${ALIAS}`).set(bearer(staff.token))).status).toBe(404);
  });
});

describe('GET /api/loan/info/:alias/:loanNumber', () => {
  test('happy path', async () => {
    mockActiveLoansOk();
    setAspektResponse('GET', '/api/getLoan/', {
      status: 200,
      data: { Body: { LoanNumber: LOAN, Amount: 100, NumberOfInstallments: 12, RemainingAmount: 80, RemainingInstallments: 9 } },
    });
    const res = await request(app).get(`/api/loan/info/${ALIAS}/${LOAN}`).set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.data.installmentsPaid).toBe(3);
  });

  test('404 when loan not owned', async () => {
    mockActiveLoansOk([{ LoanNumber: 'other' }]);
    expect((await request(app).get(`/api/loan/info/${ALIAS}/${LOAN}`).set(bearer(staff.token))).status).toBe(404);
  });
});

describe('GET /api/loan/repayment/:alias/:loanNumber', () => {
  test('happy path', async () => {
    mockActiveLoansOk();
    setAspektResponse('GET', '/api/repaymentPlan/', {
      status: 200,
      data: { Body: [{ RepaymentPlan: [
        { Installment: 1, DateFrom: '01.01.2024', DateTo: '01.02.2024', LastRepaymentDate: null, InstallmentAmount: 10, Principal: 8, Interest: 2, Balance: 92 },
      ] }] },
    });
    const res = await request(app).get(`/api/loan/repayment/${ALIAS}/${LOAN}`).set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.data.repaymentPlan[0].isPaid).toBe(false);
  });
});

describe('GET /api/loan/applications/:alias', () => {
  test('returns normalized applications', async () => {
    setAspektResponse('GET', '/api/getAllOngoingLoanApplications/', {
      status: 200,
      data: { Code: 200, Body: { Applications: [{
        Alias: ALIAS, Product: 'P', ApplicationNumber: 'APL-1', Amount: 100,
        NumberOfInstallments: '12', ApplicationDate: '01.01.2024', InterestRate: '5', ArrangementFee: '1', Status: 'Pending',
      }] } },
    });
    const res = await request(app).get(`/api/loan/applications/${ALIAS}`).set(bearer(staff.token));
    expect(res.body.data.applications[0].numberOfInstallments).toBe(12);
  });

  test('Code 420 → 404', async () => {
    setAspektResponse('GET', '/api/getAllOngoingLoanApplications/', { status: 200, data: { Code: 420, Msg: 'none' } });
    expect((await request(app).get(`/api/loan/applications/${ALIAS}`).set(bearer(staff.token))).status).toBe(404);
  });
});

describe('POST /api/loan/application/create', () => {
  test('happy path', async () => {
    setAspektResponse('POST', '/api/createLoanApplication/', {
      status: 200, data: { Code: 200, Body: { Alias: '12341564413', ApplicationNumber: 'APL-1' } },
    });
    const res = await request(app).post('/api/loan/application/create').set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.data.applicationNumber).toBe('APL-1');
  });

  test('Code 432 → 400', async () => {
    setAspektResponse('POST', '/api/createLoanApplication/', { status: 200, data: { Code: 432, Msg: 'bad product' } });
    const res = await request(app).post('/api/loan/application/create').set(bearer(staff.token));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/loan/applications-on-date', () => {
  test('400 missing Date', async () => {
    expect((await request(app).post('/api/loan/applications-on-date').set(bearer(staff.token)).send({})).status).toBe(400);
  });

  test('400 bad date format', async () => {
    expect((await request(app).post('/api/loan/applications-on-date').set(bearer(staff.token)).send({ Date: '2024-01-01' })).status).toBe(400);
  });

  test('returns mapped applications', async () => {
    setAspektResponse('GET', '/api/getAllLoanApplicationsOnDate/', {
      status: 200, data: { Code: 200, Body: [{ Alias: ALIAS, ApplicationNumber: 'A', Amount: 1, Status: 'New', StatusCode: 'N' }] },
    });
    const res = await request(app).post('/api/loan/applications-on-date').set(bearer(staff.token)).send({ Date: '06.11.2019' });
    expect(res.body.data.totalCount).toBe(1);
  });
});

describe('test endpoints', () => {
  test('they proxy responses through with success:true', async () => {
    setAspektResponse('GET', '/api/checkLoanStatus/', { status: 200, data: { Code: 200, Body: {} } });
    setAspektResponse('GET', '/api/getActiveLoans/', { status: 200, data: { Code: 200, Body: {} } });
    setAspektResponse('GET', '/api/getLoan/', { status: 200, data: { Code: 200, Body: {} } });
    setAspektResponse('GET', '/api/repaymentPlan/', { status: 200, data: { Code: 200, Body: {} } });
    setAspektResponse('POST', '/api/loanRepayment/', { status: 200, data: { Code: 200, Body: {} } });
    setAspektResponse('POST', '/api/createLoanApplication/', { status: 200, data: { Code: 200, Body: {} } });

    expect((await request(app).post('/api/loan/test-loan-status').set(bearer(staff.token))).status).toBe(200);
    expect((await request(app).post('/api/loan/test-active-loans').set(bearer(staff.token))).status).toBe(200);
    expect((await request(app).post('/api/loan/test-loan-details').set(bearer(staff.token))).status).toBe(200);
    expect((await request(app).post('/api/loan/test-repayment-plan').set(bearer(staff.token))).status).toBe(200);
    expect((await request(app).post('/api/loan/test-loan-repayment').set(bearer(staff.token))).status).toBe(200);
    expect((await request(app).post('/api/loan/test-create-loan-application').set(bearer(staff.token))).status).toBe(200);
  });
});

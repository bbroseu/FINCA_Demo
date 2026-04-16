const documentMocks = {
  createDocument: () => {
    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK: Document created successfully!",
        Body: {
          DocumentFileId: Math.floor(Math.random() * 1000) + 15
        }
      }
    };
  }
};

module.exports = documentMocks;
const sendSuccess = (res, statusCode, message, data = null) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export { sendSuccess };
export default sendSuccess;

const sanitizeUser = (user) => {
  if (!user) return user;

  const { password: _password, userRoles: _userRoles, ...safeUser } = user;
  return safeUser;
};

export { sanitizeUser };
export default sanitizeUser;

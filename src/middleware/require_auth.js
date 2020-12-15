const requireAuth = (req, res, next) => {
  const bearerToken = req.header('Authorization');
  if (bearerToken !== `Bearer ${process.env.AUTH_TOKEN}`) {
    res.status(401).send({ error: 'Authorization Failed' });
  } else {
    next();
  }
};

export default requireAuth;

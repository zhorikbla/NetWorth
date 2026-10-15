const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next){
    const authorizationHeader = req.headers.authorization;

    if(!authorizationHeader){
        return res.status(401).json({
            error: "Токен авторизации не передан",
        });
    }
    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme!=="Bearer" || !token){
        return res.status(401).json({
            error:"Используйте формат Authorization: Bearer TOKEN",
        });
    }
    try{
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        req.user = payload;

        next();
    } catch(error){
        return res.status(401).json({
            error: "Недействительный или просроченный токен",
        });
    }
}

module.exports = authMiddleware;
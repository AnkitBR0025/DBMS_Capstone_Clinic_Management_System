const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.statusCode ||
        (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED" ||
         err.code === "ER_DUP_ENTRY" ? 409 :
            err.code === "ER_NO_REFERENCED_ROW_2" ? 400 : 500);

    console.error(err.message);

    res.status(statusCode).json({
        success: false,
        message: statusCode === 409
            ? err.code === "ER_DUP_ENTRY"
                ? "A record with the same unique value already exists."
                : "This record is linked to other clinic records and cannot be deleted."
            : statusCode === 400 && err.code === "ER_NO_REFERENCED_ROW_2"
                ? "The selected related record does not exist."
                : err.message || "Internal Server Error"
    });
};

module.exports = errorMiddleware;

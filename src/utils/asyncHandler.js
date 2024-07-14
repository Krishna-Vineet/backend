/*
const asyncHandler = () => {         // async handle is an arrow function
    async () => {         // makking another async function within it
        // code here
    }
}      // Lets do this in one line below (higher order function)


////////////////

const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next)
        } catch (error) {
            res.status(error.code || 500).json({
                success: false,
                message: error.message
                })
                }
}



*/


const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }
}


export { asyncHandler }
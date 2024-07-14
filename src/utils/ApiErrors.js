class ApiError extends Error {
    constructor(
        statusCode,                      // these 4 are parameters
        message = "Something went wrong!",          // parameters with default values
        errors = [],
        stack = ""
    ){
        super(message)                    // overwrting the message and other things
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false;
        this.errors = errors

        if (stack) {
            this.stack = stack
        } else{
            Error.captureStackTrace(this, this.constructor)
        }
    }}


export { ApiError }
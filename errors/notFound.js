// import CustomError from "./customError.js"
// class NotFound extends CustomError {
//   constructor(message) {
//     super(message)
//     this.statusCode = 404
//     this.message = message
//   }
//   jsonMessage() {
//     return { message }
//   }
// }

// export default NotFound

import CustomError from "./customError.js";

class NotFound extends CustomError {
  constructor(message) {
    super(message);
    this.statusCode = 404;
    this.message = message;
  }

  jsonMessage() {
    return { message: this.message }; // Use this.message
  }
}

export default NotFound;
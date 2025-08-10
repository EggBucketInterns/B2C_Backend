import express from "express"
import multer from "multer"
import { 
    newUser ,
    getCustomerById,
    updateUser,
    updateUserAddress,
    // requestOTP,
    verifyPassword,
} from "../controllers/customerController.js"
import authenicateUser from "../middleware/authHandler.js"
const router = express.Router()

const mult = multer(); 

router.route("/user").post(newUser) //authenicateUser,
router.route("/user/:phone").patch(mult.any(),updateUser) //authenicateUser,
router.route("/user/:customerId").get( getCustomerById)
router.route("/user/:phone/addresses").patch(updateUserAddress);

router.route('/verifypassword',verifyPassword)
// router.route('/request-otp').post(requestOTP)
// router.route('/verify-otp').post(verifyOTP)

export default router

import { Router } from "express";
import {loginUser, logoutUser, registerUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getWatchHistory, getUserChannelProfile} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const userRouter = Router();


userRouter.route("/register").post(                  // we need upload.file method of multer, and then our register function
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }    
    ]),
    registerUser);

userRouter.route("/login").post(loginUser);          // we dont need any middelware for login, so just login


//  secured routes, 
// logout route can't be accessed by everyone, only by logged in users
userRouter.route("/logout").post(verifyJWT, logoutUser)  // we need verifyJWT middleware for logout, it execute and says next() at the end, then execusion comes to logoutUser
userRouter.route("/refresh-token").post(refreshAccessToken)
userRouter.route("/change-password").post(verifyJWT, changeCurrentPassword)
userRouter.route("/get-current-user").post(verifyJWT, getCurrentUser)
userRouter.route("/update-account-details").patch(verifyJWT, updateAccountDetails)         // post will update al details, and patch request will update changes
userRouter.route("/update-user-avatar").post(verifyJWT, upload.single("avatar"), updateUserAvatar)   // auth verify before multer, because user should be logged in to update avatar
userRouter.route("/update-user-cover-image").post(verifyJWT, upload.single("coverImage"), updateUserCoverImage)
userRouter.route("/c/:getUserChannelProfile").get(verifyJWT, getUserChannelProfile)    // we use  /c/: because getting item from params, not body
userRouter.route("/getWatchHistory").get(verifyJWT, getWatchHistory)
 

export default userRouter
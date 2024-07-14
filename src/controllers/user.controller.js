import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js";
import { User } from "../models/user.model.js";
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


const generateAccessAndRefreshToken = async(userId) =>
{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error){
        throw new ApiError(500, "Something went wrong while generating refresh and access token.")
    } 
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend response
    // validation - not empty
    // check if user is already registered: username, email
    // check for images, avatar compulsory
    // upload it to cloudinary, check if it is avatar or not
    // create user object and enter it in db
    // remove password and refresh token field from response
    // check for user creation, if it is registered or not
    //  return response , otherwive error


// get user details from frontend response
    const { fullName, email, username, password } =  req.body;
    
// validation - not empty
    if ( [fullName, email, username, password].some(field => field === "")) {
        throw new ApiError(400, "All fields are required");
    }


// check if user is already registered: username, email
    const existedUser = await  User.findOne({
        $or: [{ username }, { email }]
    })
    if(existedUser){
        throw new ApiError(409, "User already exist");
    }

// check for images, avatar compulsory
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files?.coverImage) && req.files?.coverImage.length > 0){
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

// upload it to cloudinary, check if it is avatar or not
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    

    // console.log(avatar);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }


// create user object and enter it in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
        email,
        password
    })
    
    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    // console.log(createdUser);

    // check for user creation, if it is registered or not
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user");
    }
//  return response , otherwive error
    return res.status(201).json(new ApiResponse(200, createdUser, "User created successfully")) || ApiError(500, "Something went wrong while registering the user");
})

const loginUser = asyncHandler(async (req, res) => {
    //  algorithm by me
    // check for the refresh token and match, if yes, provide access key and login
    // if no, take input -> username/email, password     req.body
    // check if not empty
    // check if exist in db, if no, redirect to register
    // check if password is correct
    // porvide refresh token and access token with expiries
    // succesfuly login 


    //  algorithm by sir
    // req body => data
    // username / email
    // find the user
    // password check
    // access and refresh token
    // send cookie
    // successfully login

    const {email, username, password} = req.body;

    if(!username && !email){
        throw new ApiError(400, "Username or Email is required");
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User not found");
    }

    const isPassworValid = await user.isPasswordCorrect(password);

    if(!isPassworValid){
        throw new ApiError(401, "Invalid password");
    }


    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken"); // this is done to remove password and refresh token from response to share it with frontend

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(
        200,
        {
            user: loggedInUser, accessToken, refreshToken
        },
        "User logged in succesfully"
    ))

})

// can also add controlloer to change other details.., Just an advice, keep the file updating endpoints seperate to keep it optimised.
const logoutUser = asyncHandler(async (req, res) => {

            //  remove refresh token from db
            // remove refresh token from cookie
    await User.findByIdAndUpdate(req.user._id, {          // if we did findById, we had to remove token manually then save the details with validation:false, so just do this
        // $set: {                                            // $set is used to update values, here we remove the refresh token
        //     refreshToken: undefined
        // }
        $unset: {                         // we should use $unset instead of $set for this purpose, just put flag to fields which we want to remove
            refreshToken: 1
        }
    },
    {
        new: true                 // this will return new updated user, with refresh token removed
    })


    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)    
    .clearCookie("accessToken", options)           // clearCookie method is given by cookieParser
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken || req.headers["x-refresh-token"]; // for phones

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorised request");
    }

    try {
            const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    } catch (error) {
            throw new ApiError(401, error?.email || "Invalid refresh token");
    }       
            // now we got decoded DataTransfer, and decoded has _id only (we gave only _id during refresh token creation).
            //  lets now find user in db using that _id

    const user = await User.findById(decodedToken?._id);

    if(!user){
        throw new ApiError(401, "Invalid refresh token");
    }

    // Now we will match that the token taken from cookie, and token of sepecefic user in db, whose _id we got by decoding the cookie token
    
    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "Refresh token is expired or used");
    }

    // Now when refresh token is found correctly, we need to generate new access and refresh token.

    const { newAccessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id);

    const options = {
        httpOnly: true,
        secure: true
    }

    res.status(200)
    .cookie("accessToken", newAccessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(new ApiResponse(200, {newAccessToken, newRefreshToken}, "Access token refreshed successfully"))
 
})

const changeCurrentPassword = asyncHandler( async(req, res) => {

    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user?._id);
    if(!user){
        throw new ApiError(404, "Login again to change password");
    }
    const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isOldPasswordCorrect) {
        throw new ApiError(400, "Old password is incorrect");
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    // we are not doing findbyIdandUpdate(res.user?_id,{$set: {password: newPassword}, {new: true}}), as password need bycripting and logic to handle password update is already written in save method in user model.

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));

})

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id).select("-password -refreshToken");
    return res.status(200).json(new ApiResponse(200, user, "User fetched successfully"));
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email, username} = req.body

    if (!(fullName || email || username)) {
        throw new ApiError(400, "Invalid details for updation.")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                username: username,
                fullName: fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password, -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path       // we will inject multer middleware in route, but here we get single file only, so do req.file?.path instaed of req.files?.coverImage[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    //TODO: delete old image - assignment


    const newAvatar = await uploadOnCloudinary(avatarLocalPath)

    if (!newAvatar.url) {

        throw new ApiError(400, "Error while uploading on avatar")
        
    }
    const user = await User.findById(req.user?._id)
    const oldAvatar = user.avatar;
    await deleteFromCloudinary(oldAvatar);


    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: newAvatar.url
            }
        },
        {new: true}
    ).select("-password, -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedUser, "Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    //TODO: delete old image - assignment // done
    const user = await User.findById(req.user?._id)
    const oldCoverImage = user.coverImage;
    await deleteFromCloudinary(oldCoverImage);


    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password, -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedUser, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler( async(req, res) => {
    const {username} = req.params;
    if(!username?.trim()){
        throw new ApiError(400, "Invalid username")
    }
    const channel = await User.aggregate([         // output of channel will be array of objects
        {
            $match: {                   // matching the username to get specific user detail
                username: username?.toLowerCase()         
            }
        },
        {
            $lookup: {                       // searching in Subscription model ducuments, in ducument we get user _id in channel field, that document will stored in subscribers (it is array of objects)
                from: "subscriptions",       // Subscription model will be stored as subscriptions in database
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {                       // searching in Subscription model ducuments, in ducument we get user _id in subscriber field, that document will stored in subscribedTo (it is array of objects)
                from: "subscriptions",       // these lookup aggegation pipelines are to look for some specific data, and work with them
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {                    // addFeilds pipeline is used to add new fields in model dociment, here user
                subscribersCount: {                 // count the obbjects in subscribers array to get no of subscribers
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {       // count the obbjects in subscribedTo array to get no of channels subscribed
                    $size: "$subscribedTo"
                },
                isSubscribed: {                     // check if user is subscribed or not, will return a true, false which will help the frontend developer
                    $cond: {                    // condition pipeline is used to apply conditions
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },     // in pipeline, searching if user with _id is present in any subscriber object in subscribers array   
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                createdAt: 1
            }
        }
    ])

    if(!channel?.length()){
        throw new ApiError(404, "Channel not exist")
    }

    return res.status(200).json(new ApiResponse(200, channel[0], "Channel profile found successfully"))
            // returning only the first object of the array, as it contains the main  data
})

const getWatchHistory = asyncHandler(async(req, res) => {
    // the _id we get from user isnt the actual Mongodb id, but the Mongoose id, mongoose, when contact to mondodb, itself convert this id to mongo db id.
    // but the aggregation pipelines goes directly to mongodb, mongoose, doesnt interfare here, so we can't directly use _id in aggregation pipeline, we will manually call mongoose there

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)       // matching the user id, so that we can get his watch history
            }
        },
        {
             $lookup: {
                 from: "videos",                // in video model ducuments whereever we have user _id watchHistory field, we took array of thode video documents as watchHistory
                 localField: "watchHistory",    // but one field there was owner, now we need owner details that are mentioned there, so use a sub pipeline for it
                 foreignField: "_id",
                 as: "watchHistory",                     
                 pipeline: [                // sub pipeline to get owner details
                     {
                         $lookup: {         // owner was nothing but user, so got the user whose _id was in owner field
                             from: "users",
                             localField: "owner",
                             foreignField: "_id",
                             as: "owner",
                             pipeline: [
                                {
                                    $project: {         // from there we need only name and avatar, so project them only
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                             ]
                         }
                     },
                     {
                        $addFields: {
                            owner: {       // rewriting the owner field with the first object of the owner array
                                $first: "$owner"
                            }
                        }
                     }
                 ]
             }
        }
    ])

    return res.status(200).json(new ApiResponse(200, user[0].watchHistory, "Watch history found successfully"))
})




export { registerUser, loginUser, logoutUser, refreshAccessToken,
    changeCurrentPassword, getCurrentUser, updateAccountDetails,
    updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory };
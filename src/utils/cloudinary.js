import {v2 as cloudinary} from "cloudinary"
import fs from "fs"


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfull
        //console.log("file is uploaded on cloudinary ", response.url);
        fs.unlinkSync(localFilePath);         // remove the locally saved temporary file as the upload operation got success
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null;
    }
}


const deleteFromCloudinary = async (cloudinaryURL) => {

    // Remove the protocol (https://) and split the URL by '/'
    const parts = cloudinaryURL.replace(/^https?:\/\//, '').split('/');
    // Find the index of the 'upload' part (or 'fetch' for fetched images)
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) {
        throw new Error('Invalid Cloudinary URL');
    }
    // The public_id is after the version number, which is one position after 'upload'
    const publicIdWithVersion = parts.slice(uploadIndex + 2).join('/');
    // Remove the file extension from the public_id
    const publicId = publicIdWithVersion.substring(0, publicIdWithVersion.lastIndexOf('.'));

    await cloudinary.uploader.destroy(publicId)


}

//  http://res.cloudinary.com/krishna-backend/image/upload/v1720774553/v0zvovrfwkzxzax2zglv.jpg
export {uploadOnCloudinary, deleteFromCloudinary}
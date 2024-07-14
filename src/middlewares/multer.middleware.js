import multer from "multer";

const storage = multer.diskStorage({              // using diskstorage instead of memorystorage, as memory can be overlaod
    destination: function (req, file, cb) {       // we can access file
      cb(null, "./public/temp")                   // this is folder path where we will store our file
    },
    filename: function (req, file, cb) {
      
      cb(null, file.originalname)                 // we can also manipulate file name here, but we did only original name, generally not reccomended as there can be multiple file with same name
    }
  })
  
export const upload = multer({ 
    storage, 
})
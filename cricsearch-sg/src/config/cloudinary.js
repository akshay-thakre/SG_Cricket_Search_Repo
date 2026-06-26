// Cloudinary configuration
// Set REACT_APP_CLOUDINARY_CLOUD_NAME in your .env file

export const CLOUDINARY_CLOUD_NAME =
  process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dcfhzuyhe';
export const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Helper function to build a Cloudinary image URL
// params: transformation string e.g. 'w_400,c_fill,f_auto,q_auto'
// publicId: the image path in Cloudinary e.g. 'cricksearch/moments/trophy-moment'
export function cloudinaryUrl(publicId, params = 'f_auto,q_auto') {
  return `${CLOUDINARY_BASE_URL}/${params}/${publicId}`;
}

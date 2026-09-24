import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebaseConfig";
import * as ImagePicker from "expo-image-picker";

/**
 * Pick an image from the device and upload it to Firebase Storage
 * @param {string} folder - The storage folder (e.g., 'profiles', 'logos')
 * @param {string} filename - The filename to save as
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export async function pickAndUploadImage(folder, filename) {
  try {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Sorry, we need camera roll permissions to upload images.");
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    // Get the image URI
    const uri = result.assets[0].uri;

    // Convert image to blob
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error("Failed to fetch image from device");
    }
    const blob = await response.blob();

    // Validate blob
    if (!blob || blob.size === 0) {
      throw new Error("Invalid image file");
    }

    // Create a storage reference
    const storageRef = ref(storage, `${folder}/${filename}`);

    // Upload the blob with metadata
    await uploadBytes(storageRef, blob, {
      contentType: blob.type || 'image/jpeg',
    });

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("Image upload error:", error);
    // Provide more specific error messages
    if (error.code === 'storage/unauthorized') {
      throw new Error("Storage permission denied. Please check Firebase Storage rules.");
    } else if (error.code === 'storage/canceled') {
      throw new Error("Upload was canceled");
    } else if (error.code === 'storage/unknown') {
      throw new Error("Upload failed. Please check your internet connection and try again.");
    } else {
      throw new Error(error.message || "Could not upload image. Please try again.");
    }
  }
}

/**
 * Take a photo with camera and upload it to Firebase Storage
 * @param {string} folder - The storage folder (e.g., 'profiles', 'logos')
 * @param {string} filename - The filename to save as
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export async function takePictureAndUpload(folder, filename) {
  // Request permissions
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Sorry, we need camera permissions to take photos.");
  }

  // Launch camera
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) {
    return null;
  }

  // Get the image URI
  const uri = result.assets[0].uri;

  // Convert image to blob
  const response = await fetch(uri);
  const blob = await response.blob();

  // Create a storage reference
  const storageRef = ref(storage, `${folder}/${filename}`);

  // Upload the blob
  await uploadBytes(storageRef, blob);

  // Get the download URL
  const downloadURL = await getDownloadURL(storageRef);

  return downloadURL;
}

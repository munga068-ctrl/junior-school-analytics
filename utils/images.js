import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// Lets the person choose a photo from their phone (with a crop step at the
// given aspect ratio), shrinks it to maxWidth pixels, and returns it as a
// small JPEG "data URL" string that can be saved straight into Firestore and
// shown in the app and in PDFs — no Firebase Storage (which needs a paid
// plan) involved. Returns null if they cancelled. Throws a readable message
// if photo permission is denied or the image can't be processed.
export async function pickImageAsDataUrl(aspect = [1, 1], maxWidth = 300) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("Photo library access is needed to choose an image. Enable it in your phone's settings.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return null;

  try {
    const small = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return `data:image/jpeg;base64,${small.base64}`;
  } catch (e) {
    throw new Error(e?.message || "Couldn't process that image. Try a different one.");
  }
}

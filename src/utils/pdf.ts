import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Document } from './storage';

export const exportToPdf = async (doc: Document) => {
  try {
    const pagesHtml: string[] = [];

    for (const page of doc.pages) {
      try {
        // Compress and resize image to prevent memory crashes
        const manipResult = await ImageManipulator.manipulateAsync(
          page.uri,
          [{ resize: { width: 800 } }], // Resize to a smaller, reasonable max width
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        // Embed base64 image data directly into the HTML to avoid URI access issues
        pagesHtml.push(`
          <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; overflow: hidden;">
            <img src="data:image/jpeg;base64,${manipResult.base64}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>
        `);
      } catch (pageError) {
        console.warn('Failed to compress page, using original:', pageError);

        // If manipulation fails, try to read the file as base64 as a fallback
        try {
          const base64Data = await FileSystem.readAsStringAsync(page.uri, { encoding: FileSystem.EncodingType.Base64 });
          pagesHtml.push(`
              <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; overflow: hidden;">
                <img src="data:image/jpeg;base64,${base64Data}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
              </div>
            `);
        } catch (readError) {
          console.error("Failed fallback base64 read:", readError);
        }
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page { margin: 0; }
            body { margin: 0; padding: 0; background-color: white; }
          </style>
        </head>
        <body>
          ${pagesHtml.join('')}
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Export ${doc.title}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

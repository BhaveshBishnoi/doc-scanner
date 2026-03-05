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
          [{ resize: { width: 1200 } }], // Resize to a reasonable max width for documents
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const imgSource = `data:image/jpeg;base64,${base64}`;
        pagesHtml.push(`
                    <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; width: 100%; height: 100vh;">
                    <img src="${imgSource}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                    </div>
                `);

        // Clean up the temporary compressed image
        await FileSystem.deleteAsync(manipResult.uri, { idempotent: true });
      } catch (pageError) {
        console.warn('Failed to compress page, using original:', pageError);
        // Fallback to original image if manipulation fails
        const base64 = await FileSystem.readAsStringAsync(page.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const imgSource = `data:image/jpeg;base64,${base64}`;
        pagesHtml.push(`
                    <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; width: 100%; height: 100vh;">
                    <img src="${imgSource}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                    </div>
                `);
      }
    }
    const htmlContent = `
      <html>
        <body style="margin: 0; padding: 0;">
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

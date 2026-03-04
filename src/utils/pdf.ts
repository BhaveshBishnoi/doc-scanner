import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Document } from './storage';

export const exportToPdf = async (doc: Document) => {
    try {
        const htmlContent = `
      <html>
        <body style="margin: 0; padding: 0;">
          ${doc.pages.map(page => `
            <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; width: 100%; height: 100vh;">
              <img src="${page.uri}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
            </div>
          `).join('')}
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

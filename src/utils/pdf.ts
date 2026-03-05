import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Document } from './storage';

export const exportToPdf = async (doc: Document) => {
    try {
        const pagesHtml = await Promise.all(
            doc.pages.map(async (page) => {
                const base64 = await FileSystem.readAsStringAsync(page.uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const imgSource = `data:image/jpeg;base64,${base64}`;
                return `
                    <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; width: 100%; height: 100vh;">
                    <img src="${imgSource}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                    </div>
                `;
            })
        );

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

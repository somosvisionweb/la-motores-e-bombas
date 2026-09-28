import 'server-only';
import QRCode from 'qrcode';

/** QR Code (PNG em data URL) de um "copia e cola" PIX, gerado no servidor: nada vai para serviços de terceiros. */
export async function pixQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 320, color: { dark: '#0b1420', light: '#ffffff' } });
}

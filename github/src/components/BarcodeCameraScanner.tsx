import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, X, RefreshCw, AlertCircle } from 'lucide-react';

interface BarcodeCameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeCameraScanner: React.FC<BarcodeCameraScannerProps> = ({
  onScanSuccess,
  onClose,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'barcode-scanner-viewport';

  useEffect(() => {
    let isMounted = true;

    async function initScanner() {
      try {
        setIsStarting(true);
        setErrorMessage(null);

        // Get available cameras
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          throw new Error('Tidak ada kamera yang terdeteksi di perangkat ini.');
        }

        if (!isMounted) return;
        setCameras(devices);

        // Prefer environment / back camera
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('belakang') ||
          d.label.toLowerCase().includes('environment')
        ) || devices[devices.length - 1]; // often back camera is last

        const activeId = backCamera ? backCamera.id : devices[0].id;
        setSelectedCameraId(activeId);

        // Initialize instance
        const html5QrCode = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.ITF,
          ],
          verbose: false,
        });

        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          activeId,
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.333333,
          },
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText.trim());
              // Play a gentle beep sound
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
              } catch {
                // Audio feedback optional
              }
            }
          },
          () => {
            // Frame scan failure is normal, ignore
          }
        );

        setIsStarting(false);
      } catch (err: any) {
        console.error('Camera barcode scanner error:', err);
        if (isMounted) {
          setIsStarting(false);
          let msg = err.message || 'Gagal mengakses kamera.';
          if (err.name === 'NotAllowedError' || msg.includes('Permission')) {
            msg = 'Izin kamera ditolak oleh browser. Mohon izinkan akses kamera di pengaturan browser atau gunakan input nomor resi / scanner fisik.';
          } else if (err.name === 'NotFoundError') {
            msg = 'Kamera tidak ditemukan. Pastikan perangkat Anda memiliki kamera yang aktif.';
          }
          setErrorMessage(msg);
        }
      }
    }

    initScanner();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().then(() => {
            html5QrCodeRef.current?.clear();
          }).catch(err => console.warn('Error stopping scanner:', err));
        } else {
          try {
            html5QrCodeRef.current.clear();
          } catch {
            // Ignore clear error
          }
        }
      }
    };
  }, []);

  const switchCamera = async (camId: string) => {
    if (!html5QrCodeRef.current) return;
    try {
      setIsStarting(true);
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      setSelectedCameraId(camId);
      await html5QrCodeRef.current.start(
        camId,
        {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.333333,
        },
        (decodedText) => {
          onScanSuccess(decodedText.trim());
        },
        () => {}
      );
      setIsStarting(false);
    } catch (err: any) {
      setIsStarting(false);
      setErrorMessage('Gagal beralih kamera: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0B1E36] px-4 py-3 text-white">
          <div className="flex items-center space-x-2">
            <Camera className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-sm sm:text-base">Scan Barcode / Resi Kamera HP</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[300px]">
          {isStarting && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 text-white space-y-2">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
              <p className="text-sm">Menyiapkan kamera...</p>
            </div>
          )}

          {errorMessage && (
            <div className="p-6 text-center text-white space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-900/60 text-red-300">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-sm text-red-200">{errorMessage}</p>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
              >
                Tutup & Gunakan Input Manual / Scanner USB
              </button>
            </div>
          )}

          <div id={containerId} className="w-full max-h-[360px]" />
        </div>

        {/* Controls & Instructions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {cameras.length > 1 && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-600">Pilih Kamera:</span>
                <select
                  value={selectedCameraId || ''}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  {cameras.map((c, i) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Kamera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={onClose}
              className="ml-auto rounded-lg bg-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
            >
              Selesai / Tutup
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            Arahkan garis kamera tepat ke barcode resi kurir (J&T, SiCepat, JNE, Shopee, dll).
          </p>
        </div>
      </div>
    </div>
  );
};

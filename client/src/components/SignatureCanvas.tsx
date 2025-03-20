import React, { useRef, useState } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Button } from './ui/button';

interface SignatureCanvasProps {
  onSave: (signatureDataUrl: string) => void;
  onCancel: () => void;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ onSave, onCancel }) => {
  const sigCanvas = useRef<SignaturePad>(null);
  const [isEmpty, setIsEmpty] = useState<boolean>(true);

  const handleClear = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (sigCanvas.current && !isEmpty) {
      // Use toDataURL directly instead of getTrimmedCanvas
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      console.log('Signature canvas data URL created, length:', dataUrl.length);
      onSave(dataUrl);
    } else {
      console.error('Cannot save signature: canvas is empty or not available');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Draw Your Signature</h3>
        <div className="border border-input rounded-md bg-white mb-4">
          <SignaturePad
            ref={sigCanvas}
            canvasProps={{
              className: 'w-full h-40',
              style: { touchAction: 'none' }
            }}
            dotSize={2}
            minWidth={1}
            maxWidth={3}
            penColor="black"
            backgroundColor="rgba(255, 255, 255, 0)"
            onBegin={() => setIsEmpty(false)}
          />
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isEmpty}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureCanvas;

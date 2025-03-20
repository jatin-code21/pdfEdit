import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';
import { PDFDocument, rgb } from 'pdf-lib';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import SignatureCanvas from './SignatureCanvas';

// Use a compatible worker version
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFEditorProps {
  file: File;
}

type Tool = 'text' | 'signature' | 'none';

const PDFEditor: React.FC<PDFEditorProps> = ({ file }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [showSignatureCanvas, setShowSignatureCanvas] = useState<boolean>(false);
  const [textAnnotations, setTextAnnotations] = useState<Array<{
    x: number;
    y: number;
    text: string;
    pageNumber: number;
    fontSize?: number;
    isResizing?: boolean;
  }>>([]);
  const [draggedAnnotation, setDraggedAnnotation] = useState<number | null>(null);
  const [draggedType, setDraggedType] = useState<'text' | 'signature'>('text');
  const [signatureAnnotations, setSignatureAnnotations] = useState<Array<{
    x: number;
    y: number;
    dataUrl: string;
    width: number;
    height: number;
    pageNumber: number;
    scale?: number;
  }>>([]);
  const [newTextAnnotation, setNewTextAnnotation] = useState<string>('');
  const [editingText, setEditingText] = useState<boolean>(false);
  const [editingPosition, setEditingPosition] = useState<{ x: number, y: number } | null>(null);
  
  const documentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadPdf = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        setPdfBytes(new Uint8Array(arrayBuffer));
        
        // Create a blob URL for react-pdf
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (error) {
        console.error('Error loading PDF:', error);
        toast({
          title: 'Error',
          description: 'Failed to load PDF file',
          variant: 'destructive',
        });
      }
    };

    loadPdf();
    
    // Cleanup URL on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [file, toast]); // Removed pdfUrl from dependencies to prevent infinite loop

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'none') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (activeTool === 'text') {
      setEditingPosition({ x, y });
      setEditingText(true);
    } else if (activeTool === 'signature') {
      const pageRect = e.currentTarget.getBoundingClientRect();
      setEditingPosition({
        x: pageRect.width / 2 / scale,
        y: pageRect.height / 2 / scale
      });
      setShowSignatureCanvas(true);
    }
  };

  const handleTextSubmit = () => {
    if (newTextAnnotation.trim() && editingPosition) {
      setTextAnnotations([
        ...textAnnotations,
        {
          x: editingPosition.x,
          y: editingPosition.y,
          text: newTextAnnotation,
          pageNumber: pageNumber,
          fontSize: 11, // Default font size
        },
      ]);
      setNewTextAnnotation('');
      setEditingText(false);
      setEditingPosition(null);
      setActiveTool('none');
    }
  };

  const handleAnnotationMouseDown = (e: React.MouseEvent, index: number, type: 'text' | 'signature' = 'text') => {
    e.stopPropagation();
    setDraggedAnnotation(index);
    setDraggedType(type);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedAnnotation !== null) {
        const rect = documentRef.current?.getBoundingClientRect();
        if (rect) {
          if (draggedType === 'text') {
            setTextAnnotations(prev => prev.map((annotation, index) => {
              if (index === draggedAnnotation) {
                return {
                  ...annotation,
                  x: (e.clientX - rect.left) / scale,
                  y: (e.clientY - rect.top) / scale,
                };
              }
              return annotation;
            }));
          } else {
            setSignatureAnnotations(prev => prev.map((annotation, index) => {
              if (index === draggedAnnotation) {
                return {
                  ...annotation,
                  x: (e.clientX - rect.left) / scale,
                  y: (e.clientY - rect.top) / scale,
                };
              }
              return annotation;
            }));
          }
        }
      }
    };

    const handleMouseUp = () => {
      setDraggedAnnotation(null);
    };

    if (draggedAnnotation !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedAnnotation, scale]);

  const handleSignatureAdd = (signatureDataUrl: string) => {
    // Get page dimensions for default position if needed
    const pageElement = document.querySelector('.react-pdf__Page');
    const defaultPosition = pageElement ? {
      x: pageElement.clientWidth / 2 / scale,
      y: pageElement.clientHeight / 2 / scale
    } : { x: 300, y: 400 }; // Fallback values

    const position = editingPosition || defaultPosition;
    const width = 200;
    const height = 100;
    
    setSignatureAnnotations([
      ...signatureAnnotations,
      {
        x: position.x,
        y: position.y,
        dataUrl: signatureDataUrl,
        width,
        height,
        pageNumber: pageNumber,
      },
    ]);
    setShowSignatureCanvas(false);
    setEditingPosition(null);
    setActiveTool('none');
  };

  const handleSignatureCancel = () => {
    setShowSignatureCanvas(false);
    setActiveTool('none');
  };

  const handleDownload = async () => {
    if (!pdfBytes) return;

    try {
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      // Process text annotations
      for (const annotation of textAnnotations) {
        const page = pages[annotation.pageNumber - 1];
        const { height } = page.getSize();
        
        // Use font settings that match the PDF's default font
        page.drawText(annotation.text, {
          x: annotation.x,
          y: height - annotation.y, // PDF coordinates start from bottom-left
          size: 11,
          color: rgb(0, 0, 0),
          font: await pdfDoc.embedFont('Helvetica'),
          opacity: 0.95,
        });
      }

      // Process signature annotations
      for (const annotation of signatureAnnotations) {
        const page = pages[annotation.pageNumber - 1];
        const { height } = page.getSize();
        
        // Convert data URL to image
        const img = await pdfDoc.embedPng(annotation.dataUrl);
        
        page.drawImage(img, {
          x: annotation.x,
          y: height - annotation.y - annotation.height, // PDF coordinates start from bottom-left
          width: annotation.width,
          height: annotation.height,
        });
      }

      // Save the PDF
      const modifiedPdfBytes = await pdfDoc.save();
      
      // Create a blob and download
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `edited_${file.name}`;
      link.click();
      
      toast({
        title: 'Success',
        description: 'PDF downloaded with your edits',
      });
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to save PDF file',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button 
            variant={activeTool === 'text' ? 'default' : 'outline'} 
            onClick={() => setActiveTool('text')}
          >
            Add Text
          </Button>
          <Button 
            variant={activeTool === 'signature' ? 'default' : 'outline'} 
            onClick={() => setActiveTool('signature')}
          >
            Add Signature
          </Button>
          <Button onClick={handleDownload}>Download PDF</Button>
        </div>
        <div className="flex gap-2 items-center">
          <Button 
            variant="outline" 
            onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
            disabled={scale <= 0.5}
          >
            -
          </Button>
          <span>{Math.round(scale * 100)}%</span>
          <Button 
            variant="outline" 
            onClick={() => setScale(prev => Math.min(2.0, prev + 0.1))}
            disabled={scale >= 2.0}
          >
            +
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <Button 
          variant="outline" 
          onClick={() => setPageNumber(prev => Math.max(1, prev - 1))}
          disabled={pageNumber <= 1}
        >
          Previous
        </Button>
        <span>
          Page {pageNumber} of {numPages || '--'}
        </span>
        <Button 
          variant="outline" 
          onClick={() => setPageNumber(prev => Math.min(numPages || prev, prev + 1))}
          disabled={numPages === null || pageNumber >= numPages}
        >
          Next
        </Button>
      </div>

      <div 
        ref={documentRef}
        className="border border-border rounded-lg p-4 min-h-[500px] flex items-center justify-center relative overflow-auto"
      >
        {pdfUrl ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            className="pdf-document"
          >
            <div onClick={handlePageClick} className="relative">
              <Page 
                pageNumber={pageNumber} 
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="select-text"
              />
              
              {/* Render text annotations */}
              {textAnnotations
                .filter(annotation => annotation.pageNumber === pageNumber)
                .map((annotation, index) => (
                  <div
                    key={`text-${index}`}
                    className="absolute group"
                    style={{
                      left: annotation.x * scale,
                      top: annotation.y * scale,
                      transform: 'translate(-50%, -50%)',
                      cursor: draggedAnnotation === index ? 'grabbing' : 'grab',
                      userSelect: 'none',
                      fontSize: `${(annotation.fontSize || 11) * scale}px`,
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      color: 'rgb(0, 0, 0)',
                      opacity: 0.95,
                      background: 'transparent',
                      padding: '2px'
                    }}
                    onMouseDown={(e) => handleAnnotationMouseDown(e, index)}
                  >
                    {annotation.text}
                    <div 
                      className="absolute -right-6 top-0 flex-col z-50 hidden group-hover:flex bg-white shadow-lg rounded-md p-0.5" 
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={(e) => e.stopPropagation()}
                      onMouseLeave={(e) => e.stopPropagation()}
                    >
                      <button 
                        className="p-1 hover:bg-gray-100 rounded-t text-xs w-6 h-6 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTextAnnotations(prev => prev.map((a, i) => 
                            i === index ? { ...a, fontSize: (a.fontSize || 11) + 1 } : a
                          ));
                        }}
                      >
                        +
                      </button>
                      <button 
                        className="p-1 hover:bg-gray-100 rounded-b text-xs w-6 h-6 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTextAnnotations(prev => prev.map((a, i) => 
                            i === index ? { ...a, fontSize: Math.max(8, (a.fontSize || 11) - 1) } : a
                          ));
                        }}
                      >
                        -
                      </button>
                    </div>
                  </div>
                ))}
              
              {/* Render signature annotations */}
              {signatureAnnotations
                .filter(annotation => annotation.pageNumber === pageNumber)
                .map((annotation, index) => (
                  <div
                    key={`signature-${index}`}
                    className="absolute group cursor-move"
                    style={{
                      left: annotation.x * scale,
                      top: annotation.y * scale,
                      transform: 'translate(-50%, -50%)',
                      cursor: draggedAnnotation === index ? 'grabbing' : 'grab',
                    }}
                    onMouseDown={(e) => handleAnnotationMouseDown(e, index, 'signature')}
                  >
                    <img 
                      src={annotation.dataUrl} 
                      alt="Signature" 
                      style={{
                        width: annotation.width * scale,
                        height: annotation.height * scale,
                        userSelect: 'none',
                      }}
                    />
                    <div 
                      className="absolute -right-6 top-0 flex-col z-50 hidden group-hover:flex bg-white shadow-lg rounded-md p-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={(e) => e.stopPropagation()}
                      onMouseLeave={(e) => e.stopPropagation()}
                    >
                      <button 
                        className="p-1 hover:bg-gray-100 rounded-t text-xs w-6 h-6 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSignatureAnnotations(prev => prev.map((a, i) => 
                            i === index ? { ...a, width: a.width * 1.1, height: a.height * 1.1 } : a
                          ));
                        }}
                      >
                        +
                      </button>
                      <button 
                        className="p-1 hover:bg-gray-100 rounded-b text-xs w-6 h-6 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSignatureAnnotations(prev => prev.map((a, i) => 
                            i === index ? { ...a, width: Math.max(50, a.width * 0.9), height: Math.max(25, a.height * 0.9) } : a
                          ));
                        }}
                      >
                        -
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </Document>
        ) : (
          <p className="text-muted-foreground">Loading PDF...</p>
        )}
      </div>

      {/* Text input modal */}
      {editingText && editingPosition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Add Text</h3>
            <textarea
              className="w-full border border-input rounded-md p-2 mb-4"
              rows={4}
              value={newTextAnnotation}
              onChange={(e) => setNewTextAnnotation(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setEditingText(false);
                setNewTextAnnotation('');
                setActiveTool('none');
              }}>
                Cancel
              </Button>
              <Button onClick={handleTextSubmit}>Add</Button>
            </div>
          </div>
        </div>
      )}

      {/* Signature canvas modal */}
      {showSignatureCanvas && (
        <SignatureCanvas 
          onSave={handleSignatureAdd}
          onCancel={handleSignatureCancel}
        />
      )}
    </div>
  );
};

export default PDFEditor;

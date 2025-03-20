import { useState } from 'react'
import './App.css'
import PDFUploader from './components/PDFUploader'
import PDFEditor from './components/PDFEditor'
import { Toaster } from './components/ui/toaster'

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileUpload = (file: File) => {
    setSelectedFile(file)
    // We'll add PDF editing functionality here later
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border p-4">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">PDF Edit</h1>
        </div>
      </header>
      
      <main className="container mx-auto py-8 px-4">
        {!selectedFile ? (
          <div className="max-w-md mx-auto">
            <PDFUploader onFileUpload={handleFileUpload} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">{selectedFile.name}</h2>
              <button 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
                onClick={() => setSelectedFile(null)}
              >
                Upload New File
              </button>
            </div>
            <PDFEditor file={selectedFile} />
          </div>
        )}
      </main>
      
      <Toaster />
    </div>
  )
}

export default App

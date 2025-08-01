import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, MessageCircle, Loader2, Trash2, Info, CheckSquare, Square, Sparkles, Bot, User } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import config from '../config';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';
import heroBackground from '../assets/hero-bg.jpg';

interface Document {
  id?: string;
  doc_id?: string;
  name?: string;
  filename?: string;
  size?: number;
  type?: string;
  status?: string;
  total_chunks?: number;
}

interface Message {
  id: number;
  type: 'user' | 'ai' | 'system';
  content: string;
  sources?: Array<{
    filename: string;
    text: string;
    similarity?: number;
  }>;
}

export default function ChatWithDocs() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [userId] = useState(`user_${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadUserDocuments();
  }, []);

  const loadUserDocuments = async () => {
    try {
      const response = await axios.get(`${config.API_BASE_URL}/upload/documents/${userId}`);
      setUploadedDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    setIsUploading(true);
    
    try {
      const uploadPromises = acceptedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', userId);
        
        const response = await axios.post(`${config.API_BASE_URL}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        return {
          id: response.data.filename,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'processing'
        };
      });
      
      const newFiles = await Promise.all(uploadPromises);
      setUploadedDocuments(prev => [...prev, ...newFiles]);
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        content: `📄 Uploaded ${acceptedFiles.length} file(s): ${acceptedFiles.map(f => f.name).join(', ')}. Processing in background...`
      }]);

      setTimeout(loadUserDocuments, 2000);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        content: `❌ Error uploading files: ${error.response?.data?.detail || error.message}`
      }]);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: config.ALLOWED_FILE_TYPES
  });

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    if (uploadedDocuments.length === 0) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        content: '📄 Please upload some documents first before asking questions.'
      }]);
      return;
    }
    
    if (selectedDocuments.length === 0) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        content: '📋 Please select one or more documents to search in before asking questions.'
      }]);
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      type: 'user',
      content: inputMessage
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await axios.post(`${config.API_BASE_URL}/query`, {
        user_id: userId,
        query: inputMessage,
        doc_ids: selectedDocuments,
        top_k: 5
      });
      
      const aiMessage: Message = {
        id: Date.now() + 1,
        type: 'ai',
        content: response.data.answer,
        sources: response.data.sources || []
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Query error:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'system',
        content: `❌ Error getting response: ${error.response?.data?.detail || error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const deleteDocument = async () => {
    try {
      await axios.delete(`${config.API_BASE_URL}/upload/documents/${userId}`);
      setUploadedDocuments([]);
      setSelectedDocuments([]);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        content: '🗑️ All documents deleted successfully.'
      }]);
    } catch (error: any) {
      console.error('Delete error:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        content: `❌ Error deleting documents: ${error.response?.data?.detail || error.message}`
      }]);
    }
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const selectAllDocuments = () => {
    const allDocIds = uploadedDocuments.map(doc => doc.doc_id || doc.id).filter(Boolean) as string[];
    setSelectedDocuments(allDocIds);
  };

  const deselectAllDocuments = () => {
    setSelectedDocuments([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div 
      className="min-h-screen bg-background relative"
      style={{
        backgroundImage: `linear-gradient(rgba(15, 11, 23, 0.95), rgba(15, 11, 23, 0.95)), url(${heroBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Header */}
      <div className="border-b border-glass backdrop-blur-sm bg-glass/70 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-ai-gradient shadow-glow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-ai-gradient bg-clip-text text-transparent">
                Chat with Your Docs
              </h1>
              <p className="text-muted-foreground text-sm">
                Upload documents and ask questions powered by AI
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {/* Document Management Panel */}
          <Card className="lg:col-span-1 bg-glass/50 border-glass backdrop-blur-sm shadow-elegant">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  Documents
                </CardTitle>
                <Button 
                  onClick={deleteDocument} 
                  variant="destructive"
                  size="sm"
                  disabled={uploadedDocuments.length === 0}
                  className="h-8 px-3"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Upload Area */}
              <div 
                {...getRootProps()} 
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer",
                  "hover:border-primary hover:bg-upload-hover",
                  isDragActive && "border-primary bg-upload-hover",
                  isUploading && "opacity-50 cursor-not-allowed"
                )}
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Processing files...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Drop files here or click to upload</p>
                    <p className="text-xs text-muted-foreground">Supports PDF, DOCX, TXT, MD</p>
                  </div>
                )}
              </div>

              {/* Document Selection Controls */}
              {uploadedDocuments.length > 0 && (
                <div className="flex gap-2">
                  <Button 
                    onClick={selectAllDocuments}
                    variant="outline"
                    size="sm"
                    disabled={selectedDocuments.length === uploadedDocuments.length}
                    className="flex-1"
                  >
                    <CheckSquare className="w-4 h-4 mr-1" />
                    Select All
                  </Button>
                  <Button 
                    onClick={deselectAllDocuments}
                    variant="outline"
                    size="sm"
                    disabled={selectedDocuments.length === 0}
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              )}

              {/* Document List */}
              <ScrollArea className="h-[400px] -mx-2">
                <div className="space-y-2 px-2">
                  {uploadedDocuments.map((doc) => {
                    const docId = doc.doc_id || doc.id;
                    const isSelected = docId ? selectedDocuments.includes(docId) : false;
                    
                    return (
                      <Card 
                        key={docId} 
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          isSelected && "ring-2 ring-primary bg-message-user"
                        )}
                        onClick={() => docId && toggleDocumentSelection(docId)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <FileText className="w-4 h-4 mt-0.5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.filename || doc.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {doc.total_chunks && (
                                  <Badge variant="secondary" className="text-xs">
                                    {doc.total_chunks} chunks
                                  </Badge>
                                )}
                                {doc.size && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(doc.size)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>

              {selectedDocuments.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-2">
                  <Info className="w-4 h-4" />
                  <span>{selectedDocuments.length} document(s) selected</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Interface */}
          <Card className="lg:col-span-2 bg-glass/50 border-glass backdrop-blur-sm shadow-elegant flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="w-5 h-5" />
                Chat
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col">
              {/* Messages */}
              <ScrollArea className="flex-1 -mx-2 mb-4">
                <div className="px-2 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <div className="w-16 h-16 rounded-full bg-ai-gradient-subtle flex items-center justify-center mb-4">
                        <MessageCircle className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Welcome to Chat with Your Docs!</h3>
                      <p className="text-muted-foreground">Upload some documents and start asking questions.</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="space-y-2">
                        <div className={cn(
                          "flex gap-3",
                          message.type === 'user' && "justify-end"
                        )}>
                          {message.type !== 'user' && (
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                              message.type === 'ai' && "bg-ai-gradient shadow-glow",
                              message.type === 'system' && "bg-muted"
                            )}>
                              {message.type === 'ai' ? (
                                <Bot className="w-4 h-4 text-white" />
                              ) : (
                                <Info className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          )}
                          
                          <div className={cn(
                            "rounded-lg p-3 max-w-[80%]",
                            message.type === 'user' && "bg-message-user border border-glass ml-auto",
                            message.type === 'ai' && "bg-message-ai border border-glass",
                            message.type === 'system' && "bg-muted/50 border border-glass text-sm"
                          )}>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                            
                            {/* Sources */}
                            {message.sources && message.sources.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-glass">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Sources:</p>
                                <div className="space-y-2">
                                  {message.sources.map((source, index) => (
                                    <div key={index} className="bg-muted/50 rounded p-2 text-xs">
                                      <p className="font-medium">{source.filename}</p>
                                      <p className="text-muted-foreground line-clamp-2">{source.text}</p>
                                      {source.similarity && (
                                        <Badge variant="outline" className="mt-1">
                                          {(source.similarity * 100).toFixed(1)}% match
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {message.type === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-ai-gradient shadow-glow flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-message-ai border border-glass rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a question about your documents..."
                  disabled={uploadedDocuments.length === 0 || isLoading}
                  className="resize-none min-h-[60px] max-h-[120px] bg-input/50 border-glass"
                  rows={2}
                />
                <Button 
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || uploadedDocuments.length === 0 || isLoading}
                  className="self-end bg-ai-gradient hover:shadow-glow transition-all"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { FileText, Copy, Check, Globe, Languages, Save, Plus, Edit2, Trash2, Volume2, Play, Pause } from 'lucide-react';
import { useToast } from './ToastContainer';
import { API_ENDPOINTS } from '../config/api';

interface AnnouncementTemplate {
  id: string;
  category: string;
  title: string;
  englishText: string;
  translations: {
    Marathi: string;
    Hindi: string;
    Gujarati: string;
  };
  isSaved?: boolean;
  dbId?: number;
}

interface TranslationResponse {
  original_text: string;
  translations: {
    Marathi: string;
    Hindi: string;
    Gujarati: string;
  };
  success: boolean;
  message: string;
}

interface AudioFile {
  id: number;
  english_text: string;
  english_translation: string;
  marathi_translation: string;
  hindi_translation: string;
  gujarati_translation: string;
  english_audio_path: string;
  marathi_audio_path: string;
  hindi_audio_path: string;
  gujarati_audio_path: string;
  created_at: string;
  is_active: boolean;
}

const ANNOUNCEMENT_CATEGORIES = [
  { id: 'arrival', name: 'Arrival' },
  { id: 'delay', name: 'Delay' },
  { id: 'platform_change', name: 'Platform Change' },
  { id: 'cancellation', name: 'Cancellation' },
  { id: 'general', name: 'General' },
];

export default function AnnouncementTemplates() {
  const { addToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('arrival');
  const [templates, setTemplates] = useState<AnnouncementTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AnnouncementTemplate | null>(null);
  const [editingText, setEditingText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<AnnouncementTemplate | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectedTextTranslations, setSelectedTextTranslations] = useState<{
    Marathi: string;
    Hindi: string;
    Gujarati: string;
  } | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isTranslatingSelection, setIsTranslatingSelection] = useState(false);
  const [generatedAudioFile, setGeneratedAudioFile] = useState<AudioFile | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<{ [key: string]: HTMLAudioElement }>({});
  const [generatingAudioForTemplate, setGeneratingAudioForTemplate] = useState<number | null>(null);
  
  // Audio generation progress state
  const [audioGenerationProgress, setAudioGenerationProgress] = useState({
    isGenerating: false,
    currentTemplate: 0,
    totalTemplates: 0,
    currentTemplateName: '',
    message: '',
    currentLanguage: '',
    totalLanguages: 4
  });

  useEffect(() => {
    loadTemplatesForCategory(selectedCategory);
  }, [selectedCategory]);

  // Monitor audio generation progress for debugging
  useEffect(() => {
    console.log('Audio generation progress changed:', audioGenerationProgress);
  }, [audioGenerationProgress]);

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      Object.values(audioElements).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, [audioElements]);

  const loadTemplatesForCategory = async (category: string) => {
    try {
      // Load templates from database only
      const response = await fetch(`${API_ENDPOINTS.templates.list}?category=${category}&is_active=true`);
      if (response.ok) {
        const dbTemplates = await response.json();
        
        // Convert database format to frontend format
        const convertedDbTemplates = dbTemplates.map((dbTemplate: any) => ({
          id: `db-${dbTemplate.id}`,
          category: dbTemplate.category,
          title: dbTemplate.title,
          englishText: dbTemplate.english_text,
          translations: {
            Marathi: dbTemplate.marathi_text || '',
            Hindi: dbTemplate.hindi_text || '',
            Gujarati: dbTemplate.gujarati_text || ''
          },
          isSaved: true,
          dbId: dbTemplate.id
        }));
        
        setTemplates(convertedDbTemplates);
      } else {
        console.log('Could not load from database');
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]);
    }
  };

  const translateTemplate = async (template: AnnouncementTemplate) => {
    try {
      setIsLoading(true);
      
      const response = await fetch(API_ENDPOINTS.translation.translate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: template.englishText,
          source_language: 'en'
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }

      const result: TranslationResponse = await response.json();
      
      if (result.success) {
        const updatedTemplate = {
          ...template,
          translations: result.translations
        };
        
        setTemplates(prev => 
          prev.map(t => t.id === template.id ? updatedTemplate : t)
        );
        
        addToast({
          type: 'success',
          title: 'Translation Complete',
          message: `Template "${template.title}" has been translated successfully`
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      addToast({
        type: 'error',
        title: 'Translation Failed',
        message: error.message || 'Failed to translate template'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const translateSelectedText = async (text: string) => {
    try {
      setIsTranslatingSelection(true);
      
      const response = await fetch(API_ENDPOINTS.translation.translate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          source_language: 'en'
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }

      const result: TranslationResponse = await response.json();
      
      if (result.success) {
        setSelectedTextTranslations(result.translations);
        addToast({
          type: 'success',
          title: 'Translation Complete',
          message: 'Selected text has been translated successfully'
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      addToast({
        type: 'error',
        title: 'Translation Failed',
        message: error.message || 'Failed to translate selected text'
      });
    } finally {
      setIsTranslatingSelection(false);
    }
  };

  const copyToClipboard = async (text: string, templateId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(templateId);
      addToast({
        type: 'success',
        title: 'Copied!',
        message: 'Template text copied to clipboard'
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Failed to copy text to clipboard'
      });
    }
  };

  const openAudioModal = (template: AnnouncementTemplate) => {
    setSelectedTemplate(template);
    setShowAudioModal(true);
    setGeneratedAudioFile(null);
    setSelectedText('');
    setSelectedTextTranslations(null);
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      setSelectedText(selectedText);
      setSelectedTextTranslations(null); // Reset translations for new selection
    }
  };

  const generateAudioFromSelectedText = async () => {
    if (!selectedText.trim()) {
      addToast({
        type: 'error',
        title: 'No Text Selected',
        message: 'Please select some text first'
      });
      return;
    }

    try {
      setIsGeneratingAudio(true);
      
      console.log('Generating audio for selected text:', selectedText);
      console.log('Selected text translations:', selectedTextTranslations);

      // Prepare text in all four languages
      const textInLanguages = {
        en: selectedText,
        hi: selectedTextTranslations?.Hindi || selectedText,
        mr: selectedTextTranslations?.Marathi || selectedText,
        gu: selectedTextTranslations?.Gujarati || selectedText
      };

      interface AudioResult {
        text: string;
        audio_base64?: string;
        file_name?: string;
        success: boolean;
        error?: string;
      }

      interface AudioResults {
        [key: string]: AudioResult | number | string;
      }

      const audioResults: AudioResults = {};
      const fastApiUrl = 'http://localhost:5001/text-to-speech-multi-language';

      // Generate audio for each language
      for (const [langCode, text] of Object.entries(textInLanguages)) {
        try {
          console.log(`Generating audio for ${langCode}: ${text}`);
          
          const response = await fetch(fastApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: text,
              source_language: langCode
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              audioResults[langCode] = {
                text: text,
                audio_base64: result.audio_base64,
                file_name: result.file_name,
                success: true
              };
              console.log(`✅ Audio generated for ${langCode}`);
            } else {
              audioResults[langCode] = {
                text: text,
                success: false,
                error: 'Failed to generate audio'
              };
              console.log(`❌ Audio generation failed for ${langCode}`);
            }
          } else {
            const errorData = await response.json();
            audioResults[langCode] = {
              text: text,
              success: false,
              error: errorData.detail || 'API request failed'
            };
            console.log(`❌ API error for ${langCode}:`, errorData);
          }
        } catch (error: any) {
          console.error(`Error generating audio for ${langCode}:`, error);
          audioResults[langCode] = {
            text: text,
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      }

      // Create audio file record in the FastAPI database
      try {
        const audioFileResponse = await fetch(API_ENDPOINTS.audioFiles.create, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            english_text: selectedText,
            marathi_translation: selectedTextTranslations?.Marathi || selectedText,
            hindi_translation: selectedTextTranslations?.Hindi || selectedText,
            gujarati_translation: selectedTextTranslations?.Gujarati || selectedText
          }),
        });

        if (audioFileResponse.ok) {
          const audioFileResult = await audioFileResponse.json();
          console.log('✅ Audio file record created in FastAPI database');
          audioResults.audio_file_id = audioFileResult.id;
          setGeneratedAudioFile(audioFileResult);
        } else {
          console.error('Error creating audio file record:', await audioFileResponse.text());
          audioResults.audio_file_error = 'Failed to create audio file record';
        }
      } catch (error: any) {
        console.error('Error creating audio file record:', error);
        audioResults.audio_file_error = error.message || 'Failed to create audio file record';
      }

      // Count successful audio generations
      const successfulCount = Object.values(audioResults).filter(result => 
        typeof result === 'object' && result.success
      ).length;

      addToast({
        type: 'success',
        title: 'Audio Generation Completed',
        message: `Generated audio for selected text in ${successfulCount} languages`
      });

      // Close modal after successful creation
      setTimeout(() => {
        setShowAudioModal(false);
        setSelectedTemplate(null);
        setGeneratedAudioFile(null);
        setSelectedText('');
        setSelectedTextTranslations(null);
      }, 2000);

    } catch (error: any) {
      console.error('Audio generation error:', error);
      addToast({
        type: 'error',
        title: 'Audio Generation Failed',
        message: error.message || 'Failed to generate audio files'
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const playAudio = async (audioPath: string, language: string) => {
    try {
      // Stop any currently playing audio
      if (playingAudio) {
        const currentAudio = audioElements[playingAudio];
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
        setPlayingAudio(null);
      }

      // Construct the full audio URL
      const isDevelopment = window.location.port === '5173';
      const baseUrl = isDevelopment ? 'http://localhost' : window.location.origin;
      const audioUrl = `${baseUrl}${audioPath}`;

      console.log(`Playing audio for ${language}: ${audioUrl}`);

      // Create new audio element
      const audio = new Audio(audioUrl);
      
      // Pre-flight HEAD request to verify file accessibility
      try {
        const headResponse = await fetch(audioUrl, { method: 'HEAD' });
        if (!headResponse.ok) {
          throw new Error(`Audio file not accessible: HTTP ${headResponse.status}`);
        }
      } catch (error) {
        console.error(`Audio loading error:`, error);
        addToast({
          type: 'error',
          title: 'Audio Loading Error',
          message: `Failed to load ${language} audio file. Please try again later.`
        });
        return;
      }

      // Set up audio event handlers
      audio.addEventListener('loadstart', () => {
        console.log(`${language} audio loading started`);
      });

      audio.addEventListener('canplay', () => {
        console.log(`${language} audio can play`);
      });

      audio.addEventListener('error', (event) => {
        console.error(`${language} audio loading error:`, event);
        addToast({
          type: 'error',
          title: 'Audio Playback Error',
          message: `Failed to play ${language} audio. Please try again later.`
        });
        setPlayingAudio(null);
      });

      audio.addEventListener('ended', () => {
        console.log(`${language} audio playback ended`);
        setPlayingAudio(null);
      });

      // Store audio element and start playing
      const audioKey = `${language}_${audioPath}`;
      setAudioElements(prev => ({ ...prev, [audioKey]: audio }));
      setPlayingAudio(audioKey);
      
      await audio.play();

    } catch (error: any) {
      console.error(`Error playing ${language} audio:`, error);
      addToast({
        type: 'error',
        title: 'Audio Playback Error',
        message: `Failed to play ${language} audio. Please try again later.`
      });
      setPlayingAudio(null);
    }
  };

  const stopAudio = () => {
    if (playingAudio) {
      const audio = audioElements[playingAudio];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlayingAudio(null);
    }
  };

  const saveTemplateToDatabase = async (template: AnnouncementTemplate) => {
    try {
      setIsLoading(true);
      
      const payload = {
        category: template.category,
        title: template.title,
        english_text: template.englishText,
        marathi_text: template.translations.Marathi || null,
        hindi_text: template.translations.Hindi || null,
        gujarati_text: template.translations.Gujarati || null,
      };

      const response = await fetch(API_ENDPOINTS.templates.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle duplicate error specifically
        if (response.status === 409) {
          addToast({
            type: 'warning',
            title: 'Duplicate Text Found',
            message: errorData.detail || 'This English text already exists in the database'
          });
          return;
        }
        
        throw new Error(errorData.detail || `Failed to save template: ${response.statusText}`);
      }

      const savedTemplate = await response.json();
      
      // Update the template with database ID and saved status
      const updatedTemplate = {
        ...template,
        dbId: savedTemplate.id,
        isSaved: true
      };
      
      setTemplates(prev => 
        prev.map(t => t.id === template.id ? updatedTemplate : t)
      );
      
      addToast({
        type: 'success',
        title: 'Template Saved',
        message: `Template "${template.title}" has been saved to database`
      });
      
      setShowSaveModal(false);
      setEditingTemplate(null);
    } catch (error: any) {
      console.error('Save error:', error);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: error.message || 'Failed to save template'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTemplateFromDatabase = async (template: AnnouncementTemplate) => {
    if (!template.dbId) return;
    
    try {
      setIsLoading(true);
      
      const response = await fetch(API_ENDPOINTS.templates.delete(template.dbId), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete template: ${response.statusText}`);
      }

      // Remove from local state
      setTemplates(prev => prev.filter(t => t.id !== template.id));
      
      addToast({
        type: 'success',
        title: 'Template Deleted',
        message: `Template "${template.title}" has been deleted from database`
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: error.message || 'Failed to delete template'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const editTemplate = (template: AnnouncementTemplate) => {
    setEditingTemplate(template);
    setEditingText(template.englishText);
    setShowEditModal(true);
  };

  const updateTemplateInDatabase = async () => {
    if (!editingTemplate || !editingTemplate.dbId) return;
    
    try {
      setIsLoading(true);
      
      // First translate the updated English text
      const response = await fetch(API_ENDPOINTS.translation.translate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: editingText,
          source_language: 'en'
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }

      const translationResult = await response.json();
      
      if (!translationResult.success) {
        throw new Error(translationResult.message || 'Translation failed');
      }

      // Update the template in database with new text and translations
      const updatePayload = {
        english_text: editingText,
        marathi_text: translationResult.translations.Marathi,
        hindi_text: translationResult.translations.Hindi,
        gujarati_text: translationResult.translations.Gujarati,
      };

      const updateResponse = await fetch(API_ENDPOINTS.templates.update(editingTemplate.dbId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update template: ${updateResponse.statusText}`);
      }

      const updatedTemplate = await updateResponse.json();
      
      // Update local state
      const updatedLocalTemplate = {
        ...editingTemplate,
        englishText: editingText,
        translations: {
          Marathi: translationResult.translations.Marathi,
          Hindi: translationResult.translations.Hindi,
          Gujarati: translationResult.translations.Gujarati,
        }
      };
      
      setTemplates(prev => 
        prev.map(t => t.id === editingTemplate.id ? updatedLocalTemplate : t)
      );
      
      addToast({
        type: 'success',
        title: 'Template Updated',
        message: `Template "${editingTemplate.title}" has been updated and re-translated`
      });
      
      setShowEditModal(false);
      setEditingTemplate(null);
      setEditingText('');
    } catch (error: any) {
      console.error('Update error:', error);
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update template'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAudioForAllTemplatesInCategory = async () => {
    const templatesToProcess = templates.filter(t => t.dbId); // Only saved templates
    
    if (templatesToProcess.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Templates to Process',
        message: 'No saved templates found in this category to generate audio for'
      });
      return;
    }

    try {
      // Show progress modal
      setAudioGenerationProgress({
        isGenerating: true,
        currentTemplate: 0,
        totalTemplates: templatesToProcess.length,
        currentTemplateName: '',
        message: 'Starting audio generation for all templates in this category...',
        currentLanguage: '',
        totalLanguages: 4
      });

      // Force a small delay to ensure modal shows
      await new Promise(resolve => setTimeout(resolve, 100));

      const results = [];
      
      // Process templates one by one
      for (let i = 0; i < templatesToProcess.length; i++) {
        const template = templatesToProcess[i];
        
        // Update progress for current template
        setAudioGenerationProgress(prev => ({
          ...prev,
          currentTemplate: i + 1,
          currentTemplateName: template.title,
          message: `Processing template ${i + 1} of ${templatesToProcess.length}: ${template.title}`
        }));

        try {
          // Call the announcement-audio API to create segments
          const announcementResponse = await fetch('http://localhost:5001/api/announcement-audio/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              template_id: template.dbId
            }),
          });

          if (announcementResponse.ok) {
            console.log(`✅ Announcement segments started for: ${template.title}`);
            results.push({ template: template.title, status: 'success', type: 'segments' });
          } else if (announcementResponse.status === 409) {
            console.log(`⚠️ Segments already exist for: ${template.title}`);
            results.push({ template: template.title, status: 'skipped', type: 'segments' });
          } else {
            console.log(`❌ Failed to create segments for: ${template.title}`);
            results.push({ template: template.title, status: 'error', type: 'segments' });
                    }

          // Generate audio files using multi-language API
          const templateTexts = {
            en: template.englishText,
            hi: template.translations.Hindi || template.englishText,
            mr: template.translations.Marathi || template.englishText,
            gu: template.translations.Gujarati || template.englishText
          };

          const languages = ['en', 'hi', 'mr', 'gu'];
          const languageNames = { en: 'English', hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati' };
          
          // Process each language
          for (let langIndex = 0; langIndex < languages.length; langIndex++) {
            const langCode = languages[langIndex];
            const text = templateTexts[langCode as keyof typeof templateTexts];
            
            // Update progress for current language
            setAudioGenerationProgress(prev => ({
              ...prev,
              currentLanguage: languageNames[langCode as keyof typeof languageNames],
              message: `Processing template ${i + 1} of ${templatesToProcess.length}: ${template.title} (${languageNames[langCode as keyof typeof languageNames]})`
            }));

            try {
              const response = await fetch('http://localhost:5001/text-to-speech-multi-language', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: text,
                  source_language: langCode
                }),
              });

              if (response.ok) {
                console.log(`✅ Audio generated for ${template.title} in ${languageNames[langCode as keyof typeof languageNames]}`);
              } else {
                console.log(`❌ Failed to generate audio for ${template.title} in ${languageNames[langCode as keyof typeof languageNames]}`);
              }
            } catch (error) {
              console.error(`Error generating audio for ${template.title} in ${languageNames[langCode as keyof typeof languageNames]}:`, error);
            }

            // Small delay between languages
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Create audio file record
          try {
            const audioFileResponse = await fetch(API_ENDPOINTS.audioFiles.create, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                english_text: template.englishText,
                marathi_translation: template.translations.Marathi || template.englishText,
                hindi_translation: template.translations.Hindi || template.englishText,
                gujarati_translation: template.translations.Gujarati || template.englishText,
                template_id: template.dbId // Add template_id to identify announcement template audio
              }),
            });

            if (audioFileResponse.ok) {
              console.log(`✅ Audio file record created for: ${template.title}`);
              results.push({ template: template.title, status: 'success', type: 'audio_file' });
            } else {
              console.log(`❌ Failed to create audio file record for: ${template.title}`);
              results.push({ template: template.title, status: 'error', type: 'audio_file' });
            }
          } catch (error) {
            console.error(`Error creating audio file record for ${template.title}:`, error);
            results.push({ template: template.title, status: 'error', type: 'audio_file' });
          }

          // Small delay between templates
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`Error processing template ${template.title}:`, error);
          results.push({ template: template.title, status: 'error', type: 'general' });
        }
      }

      // Hide progress modal
      setAudioGenerationProgress({
        isGenerating: false,
        currentTemplate: 0,
        totalTemplates: 0,
        currentTemplateName: '',
        message: '',
        currentLanguage: '',
        totalLanguages: 4
      });

      // Show completion message
      const successCount = results.filter(r => r.status === 'success').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      let message = '';
      if (successCount > 0) {
        message += `Successfully processed ${successCount} templates. `;
      }
      if (skippedCount > 0) {
        message += `Skipped ${skippedCount} templates (segments already exist). `;
      }
      if (errorCount > 0) {
        message += `${errorCount} templates had errors.`;
      }

      addToast({
        type: successCount > 0 ? 'success' : 'warning',
        title: 'Category Audio Generation Complete',
        message: message.trim()
      });

    } catch (error: any) {
      // Hide progress modal on error
      setAudioGenerationProgress({
        isGenerating: false,
        currentTemplate: 0,
        totalTemplates: 0,
        currentTemplateName: '',
        message: '',
        currentLanguage: '',
        totalLanguages: 4
      });

      console.error('Error generating audio for category:', error);
      addToast({
        type: 'error',
        title: 'Audio Generation Failed',
        message: error.message || 'Failed to generate audio for category'
      });
    }
  };

  const generateAudioSegments = async (template: AnnouncementTemplate) => {
    if (!template.dbId) {
      addToast({
        type: 'error',
        title: 'Cannot Generate Audio',
        message: 'Template must be saved to database before generating audio'
      });
      return;
    }

    try {
      setGeneratingAudioForTemplate(template.dbId);
      
      console.log('Generating audio segments for template:', template.title);

      // Call the announcement-audio API to create segments for Announcement Segments page
      const announcementResponse = await fetch('http://localhost:5001/api/announcement-audio/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: template.dbId
        }),
      });

      if (!announcementResponse.ok) {
        const errorData = await announcementResponse.json();
        if (announcementResponse.status === 409) {
          addToast({
            type: 'warning',
            title: 'Audio Segments Already Exist',
            message: 'Audio segments already exist for this template in the Announcement Segments section'
          });
        } else {
          throw new Error(errorData.detail || 'Failed to generate audio segments');
        }
      } else {
        const result = await announcementResponse.json();
        console.log('✅ Announcement audio segments generation started:', result);
        addToast({
          type: 'success',
          title: 'Audio Segments Generation Started',
          message: `Audio segments generation started for "${template.title}". You can monitor progress in the Announcement Segments section.`
        });
      }

      // Also generate audio files using the multi-language API for Audio Files page
      console.log('Generating audio files for template:', template.title);
      console.log('Template multilingual text:', {
        english: template.englishText,
        hindi: template.translations.Hindi,
        marathi: template.translations.Marathi,
        gujarati: template.translations.Gujarati
      });

      // Prepare template text in all four languages
      const templateTexts = {
        en: template.englishText,
        hi: template.translations.Hindi || template.englishText,
        mr: template.translations.Marathi || template.englishText,
        gu: template.translations.Gujarati || template.englishText
      };

      interface AudioResult {
        text: string;
        audio_base64?: string;
        file_name?: string;
        success: boolean;
        error?: string;
      }

      interface AudioResults {
        [key: string]: AudioResult | number | string;
      }

      const audioResults: AudioResults = {};
      const fastApiUrl = 'http://localhost:5001/text-to-speech-multi-language';

      // Generate audio for each language
      for (const [langCode, text] of Object.entries(templateTexts)) {
        try {
          console.log(`Generating audio for ${langCode}: ${text}`);
          
          const response = await fetch(fastApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: text,
              source_language: langCode
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              audioResults[langCode] = {
                text: text,
                audio_base64: result.audio_base64,
                file_name: result.file_name,
                success: true
              };
              console.log(`✅ Audio generated for ${langCode}`);
            } else {
              audioResults[langCode] = {
                text: text,
                success: false,
                error: 'Failed to generate audio'
              };
              console.log(`❌ Audio generation failed for ${langCode}`);
            }
          } else {
            const errorData = await response.json();
            audioResults[langCode] = {
              text: text,
              success: false,
              error: errorData.detail || 'API request failed'
            };
            console.log(`❌ API error for ${langCode}:`, errorData);
          }
        } catch (error: any) {
          console.error(`Error generating audio for ${langCode}:`, error);
          audioResults[langCode] = {
            text: text,
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      }

      // Create audio file record in the FastAPI database with template_id to identify it
      try {
        const audioFileResponse = await fetch(API_ENDPOINTS.audioFiles.create, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            english_text: template.englishText,
            marathi_translation: template.translations.Marathi || template.englishText,
            hindi_translation: template.translations.Hindi || template.englishText,
            gujarati_translation: template.translations.Gujarati || template.englishText,
            template_id: template.dbId // Add template_id to identify announcement template audio
          }),
        });

        if (audioFileResponse.ok) {
          const audioFileResult = await audioFileResponse.json();
          console.log('✅ Audio file record created in FastAPI database');
          audioResults.audio_file_id = audioFileResult.id;
        } else {
          console.error('Error creating audio file record:', await audioFileResponse.text());
          audioResults.audio_file_error = 'Failed to create audio file record';
        }
      } catch (error: any) {
        console.error('Error creating audio file record:', error);
        audioResults.audio_file_error = error.message || 'Failed to create audio file record';
      }

      // Count successful audio generations
      const successfulCount = Object.values(audioResults).filter(result => 
        typeof result === 'object' && result.success
      ).length;

      addToast({
        type: 'success',
        title: 'Audio Generation Completed',
        message: `Generated audio for template "${template.title}" in ${successfulCount} languages. Audio segments also created for Announcement Segments section.`
      });

    } catch (error: any) {
      console.error('Error generating audio segments:', error);
      addToast({
        type: 'error',
        title: 'Audio Generation Failed',
        message: error.message || 'Failed to generate audio segments'
      });
    } finally {
      setGeneratingAudioForTemplate(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Announcement Templates</h2>
        <p className="text-gray-600 text-xs">Pre-defined announcement templates in multiple languages for railway announcements</p>
      </div>

      {/* Combined Category Selection and Templates */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Category Selection */}
        <div className="mb-4">
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-48 px-3 py-1 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent appearance-none bg-white text-sm"
              >
                {ANNOUNCEMENT_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Templates */}
        <div className="space-y-4">
          {templates.length > 0 ? (
            templates.map((template) => (
              <div key={template.id} className="border border-gray-200 rounded-none p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{template.title}</h4>
                    <p className="text-sm text-gray-500">Template ID: {template.id}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(template.englishText, template.id)}
                      className="px-2 py-1 bg-[#337ab7] text-white rounded-none hover:bg-[#2e6da4] text-xs transition-colors"
                      title="Copy the English template text to clipboard"
                    >
                      {copiedId === template.id ? 'Copied!' : 'Copy'}
                    </button>
                    {template.translations.Marathi && (
                      <>
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowSaveModal(true);
                          }}
                          disabled={template.isSaved}
                          className={`px-2 py-1 rounded-none text-xs transition-colors ${
                            template.isSaved
                              ? 'bg-green-100 text-green-700 cursor-not-allowed'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                          title={template.isSaved ? 'Template is already saved to database' : 'Save this template to the database for future use'}
                        >
                          {template.isSaved ? 'Saved' : 'Save'}
                        </button>

                      </>
                    )}
                    {template.isSaved && template.dbId && (
                      <>
                        <button
                          onClick={() => editTemplate(template)}
                          className="px-2 py-1 bg-yellow-600 text-white rounded-none hover:bg-yellow-700 text-xs transition-colors"
                          title="Edit this template's English text and update translations"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => generateAudioSegments(template)}
                          disabled={generatingAudioForTemplate === template.dbId}
                          className="px-2 py-1 bg-purple-600 text-white rounded-none hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs transition-colors"
                          title="Generate audio files for this template in all supported languages (English, Marathi, Hindi, Gujarati)"
                          style={{ display: 'none' }}
                        >
                          {generatingAudioForTemplate === template.dbId ? 'Generating...' : 'Generate Audio'}
                        </button>
                        <button
                          onClick={() => deleteTemplateFromDatabase(template)}
                          className="px-2 py-1 bg-red-600 text-white rounded-none hover:bg-red-700 text-xs transition-colors"
                          title="Delete this template from the database. This action cannot be undone."
                        >
                          Delete
                        </button>
                      </>
                    )}
                    
                    {/* Generate Audio for All Templates in Category */}
                    {template.isSaved && template.dbId && (
                      <button
                        onClick={generateAudioForAllTemplatesInCategory}
                        disabled={audioGenerationProgress.isGenerating || templates.filter(t => t.dbId).length === 0}
                        className="px-2 py-1 bg-purple-600 text-white rounded-none hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs transition-colors"
                        title="Generate audio for all saved templates in this category"
                      >
                        {audioGenerationProgress.isGenerating ? 'Generating...' : 'Generate Audio for All'}
                      </button>
                    )}
                  </div>
                </div>

                {/* English Template */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900 flex items-center text-sm">
                      <Globe className="h-4 w-4 mr-2" />
                      English Template
                    </h5>
                    {!template.translations.Marathi && (
                      <button
                        onClick={() => translateTemplate(template)}
                        disabled={isLoading}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded-none hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Translate this template to Marathi, Hindi, and Gujarati languages"
                      >
                        {isLoading ? 'Translating...' : 'Translate'}
                      </button>
                    )}
                  </div>
                  <div 
                    className="bg-gray-50 p-3 rounded-none border border-gray-200 cursor-text select-text"
                    onMouseUp={handleTextSelection}
                    onKeyUp={handleTextSelection}
                  >
                    <p className="text-gray-800 font-mono text-sm">{template.englishText}</p>
                  </div>
                </div>

                {/* Translations - Always Visible */}
                <div className="space-y-2">
                  <h5 className="font-medium text-gray-900 text-sm">Translations</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {Object.entries(template.translations).map(([language, translation]) => {
                      const getLanguageDisplayName = (lang: string) => {
                        switch (lang) {
                          case 'Marathi': return 'मराठी';
                          case 'Hindi': return 'हिंदी';
                          case 'Gujarati': return 'ગુજરાતી';
                          default: return lang;
                        }
                      };
                      
                      return (
                        <div key={language} className="border border-gray-200 rounded-none">
                          <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200">
                            <h6 className="font-medium text-gray-900 text-xs">{getLanguageDisplayName(language)}</h6>
                          </div>
                        <div className="p-2">
                          {translation ? (
                            <div className="flex items-center justify-between">
                              <p className="text-gray-800 font-mono text-xs flex-1">{translation}</p>
                              <button
                                onClick={() => copyToClipboard(translation, `${template.id}-${language}`)}
                                className="ml-2 p-1 text-gray-500 hover:text-gray-700"
                                title={`Copy ${language} translation to clipboard`}
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-gray-500 text-xs italic">Translation not available</p>
                          )}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No templates found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No templates available for this category. Please seed the database first by running:
                <br />
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">./seed_database.sh</code>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Audio Generation Progress Modal */}
      {audioGenerationProgress.isGenerating && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border-2 border-gray-200 shadow-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#337ab7] mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Audio for Category</h3>
              <p className="text-sm text-gray-600 mb-4">{audioGenerationProgress.message}</p>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-[#337ab7] h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${audioGenerationProgress.totalTemplates > 0 ? (audioGenerationProgress.currentTemplate / audioGenerationProgress.totalTemplates) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              
              {/* Progress Text */}
              <div className="text-sm text-gray-700">
                <p>Progress: {audioGenerationProgress.currentTemplate} of {audioGenerationProgress.totalTemplates} templates</p>
                {audioGenerationProgress.currentTemplateName && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {audioGenerationProgress.currentTemplateName}
                  </p>
                )}
                {audioGenerationProgress.currentLanguage && (
                  <p className="text-xs text-gray-500 mt-1">
                    Language: {audioGenerationProgress.currentLanguage}
                  </p>
                )}
              </div>
              
              <p className="text-xs text-gray-500 mt-4 mb-4">
                Please wait while audio is being generated for all templates in this category...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Audio Generation Modal */}
      {showAudioModal && selectedTemplate && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto border-2 border-gray-200 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Generate Audio from Selected Text</h3>
              <button
                onClick={() => {
                  setShowAudioModal(false);
                  setSelectedTemplate(null);
                  setGeneratedAudioFile(null);
                  setSelectedText('');
                  setSelectedTextTranslations(null);
                  stopAudio();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Template Information */}
              <div className="bg-gray-50 p-4 rounded-none border">
                <h4 className="font-medium text-gray-900 mb-2">Template Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <p className="text-gray-900">{selectedTemplate.title}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Category</label>
                    <p className="text-gray-900">{selectedTemplate.category}</p>
                  </div>
                </div>
              </div>

              {/* Text Selection Instructions */}
              <div className="bg-[#f0f4f8] p-4 rounded-none border border-[#c3d4e5]">
                <div className="flex items-center space-x-2 mb-2">
                  <Volume2 className="h-5 w-5 text-[#337ab7]" />
                  <h4 className="font-medium text-[#1e4a6b]">How to Select Text</h4>
                </div>
                <div className="space-y-2 text-sm text-[#337ab7]">
                  <p>1. <strong>Select text</strong> from the template below by clicking and dragging</p>
                  <p>2. <strong>Click "Translate Selection"</strong> to get translations for the selected text</p>
                  <p>3. <strong>Review translations</strong> and click "Generate Audio" to create audio files</p>
                  <p>4. <strong>Monitor progress</strong> in the Audio Files section</p>
                </div>
              </div>

              {/* Full Template Text for Selection */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Select Text from Template</h4>
                
                <div className="border border-gray-200 rounded-none">
                  <div className="bg-[#f0f4f8] px-4 py-2 border-b border-gray-200">
                    <h5 className="font-medium text-[#1e4a6b]">English Template (Click and drag to select text)</h5>
                  </div>
                  <div 
                    className="p-4 cursor-text select-text"
                    onMouseUp={handleTextSelection}
                    onKeyUp={handleTextSelection}
                  >
                    <p className="text-gray-800 leading-relaxed">{selectedTemplate.englishText}</p>
                  </div>
                </div>
              </div>

              {/* Selected Text Display */}
              {selectedText && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Selected Text</h4>
                  
                  <div className="border border-gray-200 rounded-none">
                    <div className="bg-green-50 px-4 py-2 border-b border-gray-200">
                      <h5 className="font-medium text-green-900">Selected English Text</h5>
                    </div>
                    <div className="p-4">
                      <p className="text-gray-800 font-medium">"{selectedText}"</p>
                    </div>
                  </div>

                  {/* Translation Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-gray-900">Translations</h5>
                      <button
                        onClick={() => translateSelectedText(selectedText)}
                        disabled={isTranslatingSelection}
                        className="px-3 py-1 bg-green-600 text-white rounded-none hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {isTranslatingSelection ? 'Translating...' : 'Translate Selection'}
                      </button>
                    </div>

                    {selectedTextTranslations ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {Object.entries(selectedTextTranslations).map(([language, translation]) => {
                          const getLanguageDisplayName = (lang: string) => {
                            switch (lang) {
                              case 'Marathi': return 'मराठी (Marathi)';
                              case 'Hindi': return 'हिंदी (Hindi)';
                              case 'Gujarati': return 'ગુજરાતી (Gujarati)';
                              default: return lang;
                            }
                          };

                          const getLanguageColor = (lang: string) => {
                            switch (lang) {
                              case 'Marathi': return 'bg-orange-50 text-orange-900 border-orange-200';
                              case 'Hindi': return 'bg-green-50 text-green-900 border-green-200';
                              case 'Gujarati': return 'bg-purple-50 text-purple-900 border-purple-200';
                              default: return 'bg-gray-50 text-gray-900 border-gray-200';
                            }
                          };
                          
                          return (
                            <div key={language} className={`border rounded-none ${getLanguageColor(language)}`}>
                              <div className="px-3 py-2 border-b">
                                <h6 className="font-medium text-sm">{getLanguageDisplayName(language)}</h6>
                              </div>
                              <div className="p-3">
                                <p className="text-sm">"{translation}"</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-none border border-gray-200">
                        <p className="text-gray-600 text-sm">
                          Click "Translate Selection" to get translations for the selected text.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Audio Generation Section */}
              {selectedTextTranslations && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Audio Generation</h4>
                  
                  {generatedAudioFile ? (
                    <div className="bg-green-50 p-4 rounded-none border border-green-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <Check className="h-5 w-5 text-green-600" />
                        <h5 className="font-medium text-green-900">Audio Files Generated Successfully!</h5>
                      </div>
                      <p className="text-green-700 text-sm mb-4">
                        Audio files have been created and are being processed in the background. 
                        You can view and manage them in the "Audio Files" section.
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm text-green-600">
                          <strong>Audio File ID:</strong> {generatedAudioFile.id}
                        </p>
                        <p className="text-sm text-green-600">
                          <strong>Created:</strong> {new Date(generatedAudioFile.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-purple-50 p-4 rounded-none border border-purple-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <Volume2 className="h-5 w-5 text-purple-600" />
                        <h5 className="font-medium text-purple-900">Ready to Generate Audio</h5>
                      </div>
                      <p className="text-purple-700 text-sm mb-4">
                        This will create audio files for the selected text in all four languages (English, Marathi, Hindi, Gujarati).
                      </p>
                      <div className="space-y-2 text-sm text-purple-600">
                        <p>• Audio files will be saved to <code className="bg-purple-100 px-1">/var/www/audio_files/</code></p>
                        <p>• Files will be accessible via Apache2 web server</p>
                        <p>• Processing happens in the background</p>
                        <p>• You can monitor progress in the Audio Files section</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setShowAudioModal(false);
                        setSelectedTemplate(null);
                        setGeneratedAudioFile(null);
                        setSelectedText('');
                        setSelectedTextTranslations(null);
                        stopAudio();
                      }}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-none hover:bg-gray-50"
                      title="Close the audio generation modal"
                    >
                      Close
                    </button>
                    {selectedTextTranslations && !generatedAudioFile && (
                      <button
                        onClick={generateAudioFromSelectedText}
                        disabled={isGeneratingAudio}
                        className="px-4 py-2 bg-purple-600 text-white rounded-none hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Generate audio files for the selected text in all supported languages (English, Marathi, Hindi, Gujarati)"
                      >
                        {isGeneratingAudio ? 'Generating...' : 'Generate Audio Files'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {showSaveModal && editingTemplate && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border-2 border-gray-200 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Save Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Title</label>
                <p className="text-gray-900 font-medium">{editingTemplate.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <p className="text-gray-900">{editingTemplate.category}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">English Text</label>
                <p className="text-gray-800 text-sm bg-gray-50 p-2 rounded-none border">{editingTemplate.englishText}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Translations Available</label>
                <div className="space-y-1">
                  {Object.entries(editingTemplate.translations).map(([lang, text]) => (
                    <div key={lang} className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-600 w-16">{lang}:</span>
                      <span className="text-sm text-gray-500">{text ? '✓ Available' : '✗ Not available'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setEditingTemplate(null);
                }}
                className="px-3 py-1.5 text-gray-700 border border-gray-300 rounded-none hover:bg-gray-50 text-sm"
                title="Cancel saving the template and close the modal"
              >
                Cancel
              </button>
              <button
                onClick={() => saveTemplateToDatabase(editingTemplate)}
                disabled={isLoading}
                className="px-3 py-1.5 bg-green-600 text-white rounded-none hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                title="Save this template to the database for future use and management"
              >
                {isLoading ? 'Saving...' : 'Save to Database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {showEditModal && editingTemplate && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 border-2 border-gray-200 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Title</label>
                <p className="text-gray-900 font-medium">{editingTemplate.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <p className="text-gray-900">{editingTemplate.category}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">English Text</label>
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Enter the English announcement text..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use placeholders like {'{train_number}'}, {'{train_name}'}, {'{start_station_name}'}, {'{end_station_name}'}, {'{platform_number}'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Translations</label>
                <div className="space-y-2">
                  {Object.entries(editingTemplate.translations).map(([lang, text]) => (
                    <div key={lang} className="border border-gray-200 rounded-none">
                      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{lang}</span>
                      </div>
                      <div className="p-3">
                        <p className="text-sm text-gray-600">{text || 'No translation available'}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Translations will be automatically updated when you save the changes.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTemplate(null);
                  setEditingText('');
                }}
                className="px-3 py-1.5 text-gray-700 border border-gray-300 rounded-none hover:bg-gray-50 text-sm"
                title="Cancel editing and close the modal without saving changes"
              >
                Cancel
              </button>
              <button
                onClick={updateTemplateInDatabase}
                disabled={isLoading || !editingText.trim()}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-none hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                title="Update the template text and automatically re-translate to all supported languages"
              >
                {isLoading ? 'Updating...' : 'Update & Re-translate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
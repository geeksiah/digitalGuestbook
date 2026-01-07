'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Eye, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Template {
  id: string
  name: string
  type: string
  version: number
}

interface TemplateSelectorProps {
  templates: Template[]
  selectedTemplateId?: string
  templateType: 'INVITATION' | 'RSVP' | 'GUESTBOOK' | 'THANK_YOU'
  onSelect: (templateId: string) => void
  onPreview?: (templateId: string) => void
}

export default function TemplateSelector({
  templates,
  selectedTemplateId,
  templateType,
  onSelect,
  onPreview
}: TemplateSelectorProps) {
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)

  const filteredTemplates = templates.filter(t => t.type === templateType)

  function handlePreview(templateId: string) {
    setPreviewTemplateId(templateId)
    if (onPreview) {
      onPreview(templateId)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select {templateType} Template</h3>
        <p className="text-sm text-gray-500">Choose a template for this event's {templateType.toLowerCase()} page</p>
      </div>
      {filteredTemplates.length === 0 ? (
        <div className="p-8 text-center border border-gray-200 rounded-lg bg-gray-50">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-sm text-gray-500">No {templateType.toLowerCase()} templates available</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const isSelected = selectedTemplateId === template.id
            return (
              <motion.div
                key={template.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className={`cursor-pointer transition-all ${
                    isSelected ? 'border-gray-900 bg-gray-50' : ''
                  }`}
                  onClick={() => onSelect(template.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <FileText className="h-5 w-5 text-gray-600" />
                      {isSelected && <Check className="h-5 w-5 text-gray-900" />}
                    </div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription>Version {template.version}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePreview(template.id)
                        }}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {previewTemplateId && (
        <Dialog open={!!previewTemplateId} onOpenChange={() => setPreviewTemplateId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Template Preview</DialogTitle>
              <DialogDescription>
                Preview of template: {templates.find(t => t.id === previewTemplateId)?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-500 text-center">
                Template preview would render here with injected event data
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}


import { ICanvasNodeDisplay } from '@invana/data-store';
import React, { useState } from 'react';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"



export const NodeDisplaySettings: React.FC = () => {

  const [settings, setSettings] = useState<ICanvasNodeDisplay>({
    shape: {
      type: "circle",
      size: 40,
      bgColor: "#3b82f6",
      bgOpacity: 1,
      bgPadding: 8,
      borderColor: "#2563eb",
      BorderWidth: 2,
      borderRadius: 4,
      dottedBorder: false,
      dottedBorderSpacing: 4,
      animated: false,
      iconFontFamily: "Material Icons",
      iconCode: "circle",
      iconColor: "#ffffff",
      iconSize: 24,
      iconOpacity: 1,
      iconRotate: 0,
    },
    label: {
      bgColor: "#ffffff",
      bgOpacity: 0.8,
      bgPadding: 4,
      borderColor: "#e2e8f0",
      BorderWidth: 1,
      borderRadius: 2,
      dottedBorder: false,
      dottedBorderSpacing: 0,
      textColor: "#1e293b",
      textFontSize: 12,
      textFontWeight: "normal",
      textFontFamily: "Inter",
      textOpacity: 1,
    },
    labelField: "label",
  },)

  const updateSettings = (path: string[], value: string | number) => {
    setSettings((prev) => {
      const newSettings = { ...prev }
      let current = newSettings
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]]
      }
      current[path[path.length - 1]] = value
      return newSettings
    })
  }

  const SubsectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h4 className="text-xs font-medium text-muted-foreground mb-2">{children}</h4>
  )

  return (
    <div>
      <h3 className="font-medium mb-2 text-foreground">Nodes settings</h3>
      <div className="space-y-4">
        {/* Shape Settings */}
        <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/40">
          <SubsectionTitle>Shape</SubsectionTitle>

          <div>
            <Label htmlFor="nodeType" className="text-xs text-foreground">
              Type
            </Label>
            <Select
              value={settings.shape?.type}
              onValueChange={(value) => updateSettings(["shape", "type"], value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="rectangle">Rectangle</SelectItem>
                <SelectItem value="diamond">Diamond</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <SubsectionTitle>Background</SubsectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="nodeBgColor" className="text-xs text-foreground">
                  Color
                </Label>
                <Input
                  id="nodeBgColor"
                  type="color"
                  className="h-8 bg-background border-input"
                  value={settings.shape?.bgColor as string}
                  onChange={(e) => updateSettings(["shape", "bgColor"], e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="nodeBgOpacity" className="text-xs text-foreground">
                  Opacity
                </Label>
                <div className="flex gap-2 items-center">
                  <Slider
                    id="nodeBgOpacity"
                    className="flex-1"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[settings.shape?.bgOpacity || 1]}
                    onValueChange={([value]) => updateSettings(["shape", "bgOpacity"], value)}
                  />
                  <span className="text-xs w-8 text-right text-foreground">
                    {settings.shape?.bgOpacity}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SubsectionTitle>Border</SubsectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="nodeBorderColor" className="text-xs text-foreground">
                  Color
                </Label>
                <Input
                  id="nodeBorderColor"
                  type="color"
                  className="h-8 bg-background border-input"
                  value={settings.shape?.borderColor as string}
                  onChange={(e) => updateSettings(["shape", "borderColor"], e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="nodeBorderWidth" className="text-xs text-foreground">
                  Width
                </Label>
                <div className="flex gap-2 items-center">
                  <Slider
                    id="nodeBorderWidth"
                    className="flex-1"
                    min={0}
                    max={10}
                    step={1}
                    value={[settings.shape?.BorderWidth || 1]}
                    onValueChange={([value]) => updateSettings(["shape", "BorderWidth"], value)}
                  />
                  <span className="text-xs w-8 text-right text-foreground">
                    {settings.shape?.BorderWidth}
                  </span>
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between">
                <Label htmlFor="nodeDottedBorder" className="text-xs text-foreground">
                  Dotted
                </Label>
                <Switch
                  id="nodeDottedBorder"
                  className="scale-75"
                  checked={settings.shape?.dottedBorder}
                  onCheckedChange={(checked) => updateSettings(["shape", "dottedBorder"], checked)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SubsectionTitle>Size & Animation</SubsectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label htmlFor="nodeSize" className="text-xs text-foreground">
                  Size
                </Label>
                <div className="flex gap-2 items-center">
                  <Slider
                    id="nodeSize"
                    className="flex-1"
                    min={20}
                    max={100}
                    step={1}
                    value={[settings.shape?.size || 40]}
                    onValueChange={([value]) => updateSettings(["shape", "size"], value)}
                  />
                  <span className="text-xs w-8 text-right text-foreground">{settings.shape?.size}</span>
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between">
                <Label htmlFor="nodeAnimated" className="text-xs text-foreground">
                  Animated
                </Label>
                <Switch
                  id="nodeAnimated"
                  className="scale-75"
                  checked={settings.shape?.animated}
                  onCheckedChange={(checked) => updateSettings(["shape", "animated"], checked)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Label Settings */}
        <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/40">
          <SubsectionTitle>Label</SubsectionTitle>

          <div className="space-y-3">
            <SubsectionTitle>Text</SubsectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="nodeTextColor" className="text-xs text-foreground">
                  Color
                </Label>
                <Input
                  id="nodeTextColor"
                  type="color"
                  className="h-8 bg-background border-input"
                  value={settings.label?.textColor as string}
                  onChange={(e) => updateSettings(["label", "textColor"], e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="nodeTextWeight" className="text-xs text-foreground">
                  Weight
                </Label>
                <Select
                  value={settings.label?.textFontWeight}
                  onValueChange={(value) => updateSettings(["label", "textFontWeight"], value)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Weight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="nodeTextSize" className="text-xs text-foreground">
                  Size
                </Label>
                <div className="flex gap-2 items-center">
                  <Slider
                    id="nodeTextSize"
                    className="flex-1"
                    min={8}
                    max={24}
                    step={1}
                    value={[settings.label?.textFontSize || 12]}
                    onValueChange={([value]) => updateSettings(["label", "textFontSize"], value)}
                  />
                  <span className="text-xs w-8 text-right text-foreground">
                    {settings.label?.textFontSize}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SubsectionTitle>Background</SubsectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="nodeLabelBgColor" className="text-xs text-foreground">
                  Color
                </Label>
                <Input
                  id="nodeLabelBgColor"
                  type="color"
                  className="h-8 bg-background border-input"
                  value={settings.label?.bgColor as string}
                  onChange={(e) => updateSettings(["label", "bgColor"], e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="nodeLabelBgOpacity" className="text-xs text-foreground">
                  Opacity
                </Label>
                <div className="flex gap-2 items-center">
                  <Slider
                    id="nodeLabelBgOpacity"
                    className="flex-1"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[settings.label?.bgOpacity || 0.8]}
                    onValueChange={([value]) => updateSettings(["label", "bgOpacity"], value)}
                  />
                  <span className="text-xs w-8 text-right text-foreground">
                    {settings.label?.bgOpacity}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


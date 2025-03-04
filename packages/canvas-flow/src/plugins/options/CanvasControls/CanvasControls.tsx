import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@invana/ui"
import { Separator } from "@invana/ui"
import { ButtonWithTooltip } from "@invana/ui"
import { useReactFlow, BackgroundVariant } from "@xyflow/react";
import { Eraser, Lock, MoveDown, MoveLeft, MoveRight, MoveUp, Unlock } from "lucide-react";
import useCanvasSettings from "../../../hooks/useCanvasSettings";
import { LayoutDirections } from "../../../app/types";
import { computeHandlePositions } from "../../../app/utils";


export const CanvasControls = () => {
  // const setInteractive = useStoreActions((actions) => actions.setInteractive);
  // Background, Erase, defaultEdges

  const { getEdges, getNodes, setNodes, setEdges } = useReactFlow();
  const [defaultEdgeType, setDefaultEdgeType] = React.useState('default');
  const {
    background, setBackground,
    lockViewport, toggleLockViewport,
    setLayoutDirection, layoutDirection
  } = useCanvasSettings()

  const onEdgeTypeChange = (value: string) => {
    setDefaultEdgeType(value);
    const edges = getEdges();
    edges.forEach(edge => {
      edge.type = value;
    });
    setEdges(edges)
  }

  const eraseCanvas = () => {
    if (window.confirm("Are you sure you want to erase all this data in canvas ?")) {
      setNodes([]);
      setEdges([]);
    }
  }

  const updateLayoutData = (value: LayoutDirections) => {
    setLayoutDirection(value)
    const nodes = getNodes();
    setNodes(nodes.map(node => {
      const { sourcePosition, targetPosition } = computeHandlePositions(value);
      return { ...node, sourcePosition, targetPosition }
    }))
  }

  const onBackgroundChange = (value: BackgroundVariant) => {
    setBackground({ variant: value });
  }

  return (
    // <ReactFlowProvider>
    <>
      <Select onValueChange={onBackgroundChange} >
        <SelectTrigger className="h-7 w-7 rounded-none border-none hover:border-none focus:border-none active:border-none ring-0 shadow-none !w-[80px] ">
          <SelectValue placeholder={background.variant} />
        </SelectTrigger>
        <SelectContent>
          {Object.values(BackgroundVariant).map((variant) => (
            <SelectItem key={variant} value={variant}>
              {variant}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={onEdgeTypeChange}>
        <SelectTrigger className="h-7 w-7 rounded-none border-none hover:border-none focus:border-none active:border-none ring-0 shadow-none !w-[115px] ">
          <SelectValue placeholder={defaultEdgeType} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">default</SelectItem>
          <SelectItem value="bezier">Bezier</SelectItem>
          <SelectItem value="straight">Straight</SelectItem>
          <SelectItem value="step">Step</SelectItem>
          <SelectItem value="smoothstep">Smoothstep</SelectItem>
        </SelectContent>
      </Select>
      <Separator orientation="vertical" className="h-4" />
      <Select onValueChange={(value: string) => updateLayoutData(value as LayoutDirections)} defaultValue={layoutDirection}>
        <SelectTrigger className="h-7 w-7 w-[150px] rounded-none border-none hover:border-none focus:border-none active:border-none ring-0 shadow-none">
          <SelectValue placeholder="Dagre Options" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={"LR"}>
            <span className="flex items-center"><MoveRight className="w-4 h-4 mr-2" /> Left to Right</span>
          </SelectItem>
          <SelectItem value={"RL"}>
            <span className="flex items-center"><MoveLeft className="w-4 h-4 mr-2" /> Right to Left</span>
          </SelectItem>
          <SelectItem value={"TB"}>
            <span className="flex items-center"><MoveDown className="w-4 h-4 mr-2" /> Top to Bottom</span>
          </SelectItem>
          <SelectItem value={"BT"}>
            <span className="flex items-center"><MoveUp className="w-4 h-4 mr-2" /> Bottom to Top</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <Separator orientation="vertical" className="h-4" />
      <ButtonWithTooltip
        variant="ghost"
        size="icon"
        className="rounded-none px-4"
        onClick={() => toggleLockViewport()}
        tooltip={<p>{lockViewport ? "Unlock Canvas" : "Lock Canvas"}</p>}
      >
        {lockViewport ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      </ButtonWithTooltip>
      <Separator orientation="vertical" className="h-4" />
      <ButtonWithTooltip
        variant="ghost"
        size="icon"
        className="rounded-none px-4"
        onClick={() => eraseCanvas()}
        tooltip={<p>Erase Everything</p>}
      >
        <Eraser className="h-4 w-4" />
      </ButtonWithTooltip>

    </>
    // </ReactFlowProvider >
  )
}
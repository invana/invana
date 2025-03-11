import { NodeTypes } from "@xyflow/react";
import GenericNode from "./GenericNode";
import CommentNode from "./CommentNode";
import LabeledGroupNode from "./LabeledGroupNode";
import DataFieldsNode from "./DataFieldsNode";
import DataTreeNode from "./DataTreeNode";
import CardNode from "./CardNode";
import AnnotationNode from "./AnnotationNode";


export const defaultNodeTypes: NodeTypes = {
    GenericNode: GenericNode,
    CommentNode: CommentNode,
    LabeledGroupNode: LabeledGroupNode,
    DataFieldsNode: DataFieldsNode,
    DataTreeNode: DataTreeNode,
    CardNode: CardNode,
    AnnotationNode: AnnotationNode
};
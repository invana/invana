import { NodeTypes } from "@xyflow/react";
import GenericNode from "./GenericNode";
import GenericNode2 from "./GenericNode2";
import CommentNode from "./CommentNode";
import LabeledGroupNode from "./LabeledGroupNode";
import DataFieldsNode from "./DataFieldsNode";
import DataTreeNode from "./DataTreeNode";
import CardNode from "./CardNode";
import AnnotationNode from "./AnnotationNode";


export const defaultNodeTypes: NodeTypes = {
    GenericNode: GenericNode,
    GenericNode2: GenericNode2,
    CommentNode: CommentNode,
    LabeledGroupNode: LabeledGroupNode,
    DataFieldsNode: DataFieldsNode,
    DataTreeNode: DataTreeNode,
    CardNode: CardNode,
    AnnotationNode: AnnotationNode
};
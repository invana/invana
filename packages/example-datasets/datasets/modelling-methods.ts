import { ICanvasData, ICanvasEdge, ICanvasNode } from "@invana/data-store";


export const modellingMethodsDataset: ICanvasData = {
  "nodes": [
    {
      "id": "Modeling Methods",
      "label": "Modeling Methods",
      "type": "Modeling Methods",
      properties: {
        "depth": 0,
        "blank": {},
      }
    },
    {
      "id": "Classification",
      "label": "Classification",
      "type": "Classification",
      properties: {
        "depth": 1,
        "blank": {},
      }
    },
    {
      "id": "Logistic regression",
      "label": "Logistic regression",
      "type": "Logistic regression",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Linear discriminant analysis",
      "label": "Linear discriminant analysis",
      "type": "Linear discriminant analysis",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Rules",
      "label": "Rules",
      "type": "Rules",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Decision trees",
      "label": "Decision trees",
      "type": "Decision trees",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Naive Bayes",
      "label": "Naive Bayes",
      "type": "Naive Bayes",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "K nearest neighbor",
      "label": "K nearest neighbor",
      "type": "K nearest neighbor",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Probabilistic neural network",
      "label": "Probabilistic neural network",
      "type": "Probabilistic neural network",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Support vector machine",
      "label": "Support vector machine",
      "type": "Support vector machine",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Consensus",
      "label": "Consensus",
      "type": "Consensus",
      properties: {
        "depth": 1,
        "blank": {},
      }
    },
    {
      "id": "Models diversity",
      "label": "Models diversity",
      "type": "Models diversity",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Different initializations",
      "label": "Different initializations",
      "type": "Different initializations",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Different parameter choices",
      "label": "Different parameter choices",
      "type": "Different parameter choices",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Different architectures",
      "label": "Different architectures",
      "type": "Different architectures",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Different modeling methods",
      "label": "Different modeling methods",
      "type": "Different modeling methods",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Different training sets",
      "label": "Different training sets",
      "type": "Different training sets",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Different feature sets",
      "label": "Different feature sets",
      "type": "Different feature sets",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Methods",
      "label": "Methods",
      "type": "Methods",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Classifier selection",
      "label": "Classifier selection",
      "type": "Classifier selection",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Classifier fusion",
      "label": "Classifier fusion",
      "type": "Classifier fusion",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Common",
      "label": "Common",
      "type": "Common",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Bagging",
      "label": "Bagging",
      "type": "Bagging",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Boosting",
      "label": "Boosting",
      "type": "Boosting",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "AdaBoost",
      "label": "AdaBoost",
      "type": "AdaBoost",
      properties: {
        "depth": 3,
        "blank": {},
      }
    },
    {
      "id": "Regression",
      "label": "Regression",
      "type": "Regression",
      properties: {
        "depth": 1,
        "blank": {},
      }
    },
    {
      "id": "Multiple linear regression",
      "label": "Multiple linear regression",
      "type": "Multiple linear regression",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Partial least squares",
      "label": "Partial least squares",
      "type": "Partial least squares",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Multi-layer feedforward neural network",
      "label": "Multi-layer feedforward neural network",
      "type": "Multi-layer feedforward neural network",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "General regression neural network",
      "label": "General regression neural network",
      "type": "General regression neural network",
      properties: {
        "depth": 2,
        "blank": {},
      }
    },
    {
      "id": "Support vector regression",
      "label": "Support vector regression",
      "type": "Support vector regression",
      properties: {
        "depth": 2,
        "blank": {},
      }
    }
  ] as ICanvasNode[],
  "edges": [
    {
      "id": "Modeling Methods-Classification",
      "source": "Modeling Methods",
      "target": "Classification",
      "type": "link"
    },
    {
      "id": "Modeling Methods-Consensus",
      "source": "Modeling Methods",
      "target": "Consensus",
      "type": "link"
    },
    {
      "id": "Modeling Methods-Regression",
      "source": "Modeling Methods",
      "target": "Regression",
      "type": "link"
    },
    {
      "id": "Classification-Logistic regression",
      "source": "Classification",
      "target": "Logistic regression",
      "type": "link"
    },
    {
      "id": "Classification-Linear discriminant analysis",
      "source": "Classification",
      "target": "Linear discriminant analysis",
      "type": "link"
    },
    {
      "id": "Classification-Rules",
      "source": "Classification",
      "target": "Rules",
      "type": "link"
    },
    {
      "id": "Classification-Decision trees",
      "source": "Classification",
      "target": "Decision trees",
      "type": "link"
    },
    {
      "id": "Classification-Naive Bayes",
      "source": "Classification",
      "target": "Naive Bayes",
      "type": "link"
    },
    {
      "id": "Classification-K nearest neighbor",
      "source": "Classification",
      "target": "K nearest neighbor",
      "type": "link"
    },
    {
      "id": "Classification-Probabilistic neural network",
      "source": "Classification",
      "target": "Probabilistic neural network",
      "type": "link"
    },
    {
      "id": "Classification-Support vector machine",
      "source": "Classification",
      "target": "Support vector machine",
      "type": "link"
    },
    {
      "id": "Consensus-Models diversity",
      "source": "Consensus",
      "target": "Models diversity",
      "type": "link"
    },
    {
      "id": "Consensus-Methods",
      "source": "Consensus",
      "target": "Methods",
      "type": "link"
    },
    {
      "id": "Consensus-Common",
      "source": "Consensus",
      "target": "Common",
      "type": "link"
    },
    {
      "id": "Models diversity-Different initializations",
      "source": "Models diversity",
      "target": "Different initializations",
      "type": "link"
    },
    {
      "id": "Models diversity-Different parameter choices",
      "source": "Models diversity",
      "target": "Different parameter choices",
      "type": "link"
    },
    {
      "id": "Models diversity-Different architectures",
      "source": "Models diversity",
      "target": "Different architectures",
      "type": "link"
    },
    {
      "id": "Models diversity-Different modeling methods",
      "source": "Models diversity",
      "target": "Different modeling methods",
      "type": "link"
    },
    {
      "id": "Models diversity-Different training sets",
      "source": "Models diversity",
      "target": "Different training sets",
      "type": "link"
    },
    {
      "id": "Models diversity-Different feature sets",
      "source": "Models diversity",
      "target": "Different feature sets",
      "type": "link"
    },
    {
      "id": "Methods-Classifier selection",
      "source": "Methods",
      "target": "Classifier selection",
      "type": "link"
    },
    {
      "id": "Methods-Classifier fusion",
      "source": "Methods",
      "target": "Classifier fusion",
      "type": "link"
    },
    {
      "id": "Common-Bagging",
      "source": "Common",
      "target": "Bagging",
      "type": "link"
    },
    {
      "id": "Common-Boosting",
      "source": "Common",
      "target": "Boosting",
      "type": "link"
    },
    {
      "id": "Common-AdaBoost",
      "source": "Common",
      "target": "AdaBoost",
      "type": "link"
    },
    {
      "id": "Regression-Multiple linear regression",
      "source": "Regression",
      "target": "Multiple linear regression",
      "type": "link"
    },
    {
      "id": "Regression-Partial least squares",
      "source": "Regression",
      "target": "Partial least squares",
      "type": "link"
    },
    {
      "id": "Regression-Multi-layer feedforward neural network",
      "source": "Regression",
      "target": "Multi-layer feedforward neural network",
      "type": "link"
    },
    {
      "id": "Regression-General regression neural network",
      "source": "Regression",
      "target": "General regression neural network",
      "type": "link"
    },
    {
      "id": "Regression-Support vector regression",
      "source": "Regression",
      "target": "Support vector regression",
      "type": "link"
    }
  ] as ICanvasEdge[]
}
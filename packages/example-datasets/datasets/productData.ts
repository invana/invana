import { ICanvasData, ICanvasEdge, ICanvasNode } from "@invana/data-store";

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start: Date, end: Date): string {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

// Nodes
const platform1Id = "platform_1";
const platform2Id = "platform_2";

const platforms: ICanvasNode[] = [
  {
    id: platform1Id,
    type: "Platform",
    label: "Platform 1",
    properties: { industry: "E-commerce", productsCount: 50 },
    x: getRandomInt(100, 300),
    y: getRandomInt(100, 300),
  },
  {
    id: platform2Id,
    type: "Platform",
    label: "Platform 2",
    properties: { industry: "Marketplace", productsCount: 60 },
    x: getRandomInt(700, 900),
    y: getRandomInt(100, 300),
  },
];

const products: ICanvasNode[] = Array.from({ length: 80 }, (_, i) => ({
  id: `product_${i + 1}`,
  type: "Product",
  label: `Product ${i + 1}`,
  properties: { brand: `Brand ${getRandomInt(1, 5)}`, price: getRandomInt(20, 200) },
  x: getRandomInt(300, 700),
  y: getRandomInt(300, 500),
}));

const customers: ICanvasNode[] = Array.from({ length: 40 }, (_, i) => ({
  id: `customer_${i + 1}`,
  type: "Customer",
  label: `Customer ${i + 1}`,
  properties: { age: getRandomInt(18, 50), location: `City ${getRandomInt(1, 10)}` },
  x: getRandomInt(100, 900),
  y: getRandomInt(500, 700),
}));

// Edges
const edges: ICanvasEdge[] = [];

// Platform -has_product-> Product
for (let i = 0; i < 50; i++) {
  const edge = {
    id: `edge_p1_product_${i + 1}`,
    source: platform1Id,
    target: products[i].id,
    type: "HAS_PRODUCT",
    label: "has_product",
    properties: { timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)) },
  };
  if (!edges.find(e => e.id === edge.id)) {
    edges.push(edge);
  }
}

for (let i = 0; i < 60; i++) {
  const product = products[getRandomInt(0, products.length - 1)];
  const edge = {
    id: `edge_p2_product_${i + 1}`,
    source: platform2Id,
    target: product.id,
    type: "HAS_PRODUCT",
    label: "has_product",
    properties: { timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)) },
  };
  if (!edges.find(e => e.id === edge.id)) {
    edges.push(edge);
  }
}

const reviewNodes: ICanvasNode[] = [];

// Platform -has_customer-> Customer & Customer -purchased-> Product & Customer -reviewer-> Product & Product -has_review-> Review
customers.forEach((customer) => {
  // Platform -has_customer-> Customer
  const platformSource = Math.random() < 0.5 ? platform1Id : platform2Id;
  const edge = {
    id: `edge_platform_customer_${customer.id}`,
    source: platformSource,
    target: customer.id,
    type: "HAS_CUSTOMER",
    label: "has_customer",
    properties: { timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)) },
  };
  if (!edges.find(e => e.id === edge.id)) {
    edges.push(edge);
  }

  const productsPurchasedCount = getRandomInt(1, 4);
  const productsToReviewCount = getRandomInt(0, 2);

  let lastEventTime = new Date(2023, 0, 1); // Start date for the timeseries

  for (let i = 0; i < productsPurchasedCount; i++) {
    const product = products[getRandomInt(0, products.length - 1)];
    const purchaseTime = new Date(lastEventTime.getTime() + getRandomInt(1, 60 * 60 * 24 * 7)); // Add up to 7 days
    lastEventTime = purchaseTime;

    const edge = {
      id: `edge_customer_purchased_${customer.id}_${product.id}`,
      source: customer.id,
      target: product.id,
      type: "PURCHASED",
      label: "purchased",
      properties: { timestamp: purchaseTime.toISOString() },
    };
    if (!edges.find(e => e.id === edge.id)) {
      edges.push(edge);
    }

    if (i < productsToReviewCount) {
      const reviewTime = new Date(lastEventTime.getTime() + getRandomInt(1, 60 * 60 * 24 * 3)); // Add up to 3 days
      lastEventTime = reviewTime;

      const reviewText = `This is a review by ${customer.label} for ${product.label}.`;
      const rating = getRandomInt(1, 5);
      const reviewNodeId = `review_${customer.id}_${product.id}`;

      const reviewNode = {
        id: reviewNodeId,
        type: "Review",
        label: "Review",
        properties: { review_text: reviewText, rating: rating, timestamp: reviewTime.toISOString() },
        x: getRandomInt(300, 700),
        y: getRandomInt(500, 700),
      };
      if (!reviewNodes.find(node => node.id === reviewNode.id)) {
        reviewNodes.push(reviewNode);
      }

      const edge1 = {
        id: `edge_customer_reviewer_${customer.id}_${product.id}`,
        source: customer.id,
        target: reviewNodeId,
        type: "REVIEWER",
        label: "reviewer",
        properties: { timestamp: reviewTime.toISOString() },
      };
      if (!edges.find(e => e.id === edge1.id)) {
        edges.push(edge1);
      }

      const edge2 = {
        id: `edge_product_has_review_${product.id}_${reviewNodeId}`,
        source: product.id,
        target: reviewNodeId,
        type: "HAS_REVIEW",
        label: "has_review",
        properties: { review_text: reviewText, rating: rating, timestamp: reviewTime.toISOString() },
      };
      if (!edges.find(e => e.id === edge2.id)) {
        edges.push(edge2);
      }
    }
  }
});

export const productDataSet: ICanvasData = {
  nodes: [...platforms, ...products, ...customers, ...reviewNodes],
  edges: edges,
};

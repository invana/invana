import { ICanvasData, ICanvasEdge, ICanvasNode } from "@invana/data-store"

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start: Date, end: Date): string {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

const customers: ICanvasNode[] = Array.from({ length: 50 }, (_, i) => ({
  id: `customer_${i + 1}`,
  type: "Customer",
  label: `Customer ${i + 1}`,
  properties: { age: getRandomInt(18, 60), email: `customer${i + 1}@example.com` },
  x: getRandomInt(50, 500),
  y: getRandomInt(50, 500),
}));

const products: ICanvasNode[] = Array.from({ length: 50 }, (_, i) => ({
  id: `product_${i + 1}`,
  type: "Product",
  label: `Product ${i + 1}`,
  properties: { brand: `Brand${getRandomInt(1, 10)}`, price: getRandomInt(50, 1500) },
  x: getRandomInt(600, 1000),
  y: getRandomInt(50, 500),
}));

const platforms: ICanvasNode[] = [{
  id: `platform_1`,
  type: "Platform",
  label: `Invana`,
  properties: { industry: `Data Science`, employees: 10 },
  x: getRandomInt(300, 700),
  y: getRandomInt(300, 700),
}];

const edges: ICanvasEdge[] = customers.flatMap((customer, i) => {
  const productCount = getRandomInt(0, 3); // Each customer can have 0-3 products
  const customerProducts = Array.from({ length: productCount }, (_, j) => products[getRandomInt(0, products.length - 1)]);
  const hasReview = Math.random() < 0.7; // 70% chance of having a review

  const cartId = `cart_${i + 1}`;
  const purchaseId = `purchase_${i + 1}`;
  const reviewId = `review_${i + 1}`;

  const events = [
    { id: cartId, type: "Event", label: "Add to Cart", properties: { timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)) }, x: getRandomInt(50, 500), y: getRandomInt(50, 500) },
    { id: purchaseId, type: "Event", label: "Purchase", properties: { timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)), payment: "Credit Card" }, x: getRandomInt(50, 500), y: getRandomInt(50, 500) },
    { id: reviewId, type: "Event", label: "Write Review", properties: { rating: getRandomInt(1, 5), comment: `Review for customer ${i + 1}`, timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)) }, x: getRandomInt(50, 500), y: getRandomInt(600, 900) }
  ];

  const reviewEdges = hasReview ? [
    { id: `edge_review_${i + 1}`, type: "Action", label: "Writes Review", source: customer.id, target: reviewId },
    { id: `edge_review_to_product_${i + 1}`, type: "Action", label: "Reviews Product", source: reviewId, target: products[i % 50].id }
  ] : [];

  const cartEdges = productCount > 0 ? [
    { id: `edge_cart_${i + 1}`, type: "Action", label: "Adds to Cart", source: customer.id, target: cartId },
    ...customerProducts.map((product, j) => ({
      id: `edge_cart_to_product_${i + 1}_${j + 1}`,
      type: "Action",
      label: "Refers to Product",
      source: cartId,
      target: product.id,
    }))
  ] : [];

  const purchaseEdges = productCount > 0 ? [
    { id: `edge_customer_purchase_${i + 1}`, type: "Action", label: "Customer Purchase", source: customer.id, target: purchaseId },
    ...customerProducts.map((product, j) => ({
      id: `edge_purchase_${i + 1}_${j + 1}`,
      type: "Action",
      label: "Buys Product",
      source: purchaseId,
      target: product.id,
    }))
  ] : [];

  return [
    ...cartEdges,
    ...purchaseEdges,
    ...reviewEdges,
    { id: `edge_customer_to_platform_${i + 1}`, type: "Action", label: "Has Customer", source: platforms[0].id, target: customer.id },
  ];
});

// Extract event nodes from edges
const eventNodes = edges.reduce((acc, edge) => {
  if (edge.source.startsWith('cart_') && !acc.find(node => node.id === edge.source)) {
    const customerIndex = parseInt(edge.source.split('_')[1])
    acc.push({
      id: edge.source,
      type: "Event",
      label: "Add to Cart",
      properties: { timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)) },
      x: getRandomInt(50, 500),
      y: getRandomInt(50, 500),
    })
  }
  if (edge.source.startsWith('purchase_') && !acc.find(node => node.id === edge.source)) {
    const customerIndex = parseInt(edge.source.split('_')[1])
    acc.push({
      id: edge.source,
      type: "Event",
      label: "Purchase",
      properties: { timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)), payment: "Credit Card" },
      x: getRandomInt(50, 500),
      y: getRandomInt(50, 500),
    })
  }
  if (edge.source.startsWith('review_') && !acc.find(node => node.id === edge.source)) {
    const customerIndex = parseInt(edge.source.split('_')[1])
    acc.push({
      id: edge.source,
      type: "Event",
      label: "Write Review",
      properties: { rating: getRandomInt(1, 5), comment: `Review for customer ${customerIndex + 1}`, timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)) },
      x: getRandomInt(50, 500),
      y: getRandomInt(600, 900),
    })
  }
  return acc
}, [] as ICanvasNode[]);

export const productDataSet: ICanvasData = {
  nodes: [...customers, ...products, ...platforms, ...eventNodes],
  edges,
};

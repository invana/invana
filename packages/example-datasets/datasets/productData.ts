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

const reviews: ICanvasNode[] = Array.from({ length: 50 }, (_, i) => ({
  id: `review_${i + 1}`,
  type: "Event",
  label: "Write Review",
  properties: {
    rating: getRandomInt(1, 5),
    comment: `Review ${i + 1}`,
    timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31))
  },
  x: getRandomInt(50, 500),
  y: getRandomInt(600, 900),
}));

const events: ICanvasNode[] = customers.map((customer, i) => [
  {
    id: `cart_${i + 1}`,
    type: "Event",
    label: "Add to Cart",
    properties: { timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)) },
    x: getRandomInt(50, 500),
    y: getRandomInt(50, 500),
  },
  {
    id: `purchase_${i + 1}`,
    type: "Event",
    label: "Purchase",
    properties: { timestamp: getRandomDate(new Date(2023, 0, 1), new Date(2024, 11, 31)), payment: "Credit Card" },
    x: getRandomInt(50, 500),
    y: getRandomInt(50, 500),
  },
]).flat();

const edges: ICanvasEdge[] = customers.flatMap((customer, i) => [
  { id: `edge_cart_${i + 1}`, type: "Action", label: "Adds to Cart", source: customer.id, target: `cart_${i + 1}` },
  { id: `edge_cart_to_product_${i + 1}`, type: "Action", label: "Refers to Product", source: `cart_${i + 1}`, target: products[i % 50].id },
  { id: `edge_purchase_${i + 1}`, type: "Action", label: "Buys Product", source: `purchase_${i + 1}`, target: products[i % 50].id },
  { id: `edge_customer_purchase_${i + 1}`, type: "Action", label: "Customer Purchase", source: customer.id, target: `purchase_${i + 1}` },
  { id: `edge_review_${i + 1}`, type: "Action", label: "Writes Review", source: customer.id, target: `review_${i + 1}` },
  { id: `edge_review_to_product_${i + 1}`, type: "Action", label: "Reviews Product", source: `review_${i + 1}`, target: products[i % 50].id },
]);

export const productDataSet: ICanvasData = {
  nodes: [...customers, ...products, ...events, ...reviews],
  edges,
};

// console.log("=====productDataSet", productDataSet);

import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@invana/ui';
import React from 'react';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Basic: Story = {
  args: {
    // primary: true,
    className: 'secondary',
    children: (
      <>
        <CardHeader>
          <CardTitle>Basic Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is a basic card component. It can be styled with Tailwind utilities.</p>
        </CardContent>
      </>
    ),
  },
};





// // Card with Footer
// export const WithFooter = Template.bind({});
// WithFooter.args = {
//   className: "max-w-md p-4",
//   children: (
//     <>
//       <CardHeader>
//         <CardTitle>Card with Footer</CardTitle>
//       </CardHeader>
//       <CardContent>
//         <p>This card includes a footer for additional actions or information.</p>
//       </CardContent>
//       <CardFooter>
//         <button className="btn btn-primary">Action</button>
//       </CardFooter>
//     </>
//   ),
// };


// // Interactive Card
// export const Interactive = Template.bind({});
// Interactive.args = {
//   className: "max-w-md p-4 hover:shadow-lg cursor-pointer transition-shadow",
//   children: (
//     <>
//       <CardHeader>
//         <CardTitle>Interactive Card</CardTitle>
//       </CardHeader>
//       <CardContent>
//         <p>Hover over this card to see the interactive shadow effect.</p>
//       </CardContent>
//     </>
//   ),
// };

// // Custom Styled Card
// export const CustomStyled = Template.bind({});
// CustomStyled.args = {
//   className: "max-w-md p-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg",
//   children: (
//     <>
//       <CardHeader>
//         <CardTitle>Custom Styled Card</CardTitle>
//       </CardHeader>
//       <CardContent>
//         <p>This card uses a gradient background and custom text styling.</p>
//       </CardContent>
//     </>
//   ),
// };
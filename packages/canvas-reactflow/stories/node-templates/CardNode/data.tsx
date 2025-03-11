// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Input, Label, Button } from '@invana/ui';
import { Building } from 'lucide-react';


export const data = {
  nodes: [{
    id: "2.1",
    type: "CardNode",
    data: {
      label: "Card with Html Body",
      icon: <Building />,
      body: (
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
            />
          </div>
          <Button type="submit" variant={"default"} className="w-full">
            Login
          </Button>
        </div>
      )
    },
    style: {
      width: "400px"
    },
    "position": {
      "x": -462.6688995489353,
      "y": -249.0542457456631
    },
  },
  {
    id: "2.3",
    type: "CardNode",
    data: {
      label: "With Node icon",
      icon: "https://invana.io/public/img/vendor-logos/janusgraph.png",
      body: (
        <div>
          <img src='https://picsum.photos/200/300' style={{ margin: '0 auto', width: '100%', height: 'auto' }} />
        </div>
      )
    },
    "position": {
      "x": 150.15590727594028,
      "y": -383.32989646710155
    }
  }
  ],
  edges: []
}
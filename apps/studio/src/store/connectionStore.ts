import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GraphDBConnection } from '../models';
import { LOCALSTORAGE_KEYS } from '@/constants';


export interface GraphDBConnectionState {
  connections: GraphDBConnection[];
  getConnections: () => Promise<GraphDBConnection[]>;
  createConnection: (connection: GraphDBConnection) => Promise<GraphDBConnection>;
  isConnectionNameExists: (name: string) => boolean;

  getActiveConnection: () => GraphDBConnection | undefined;
  activeConnectionId: string | undefined;
  setActiveConnectionId: (id: string | undefined) => void;

  deleteConnections: (connectionIds: string[]) => void;
  deleteAllConnections: () => void;

}

const storeName = LOCALSTORAGE_KEYS.CONNECTION

export const useConnectionStore = create(
  persist<GraphDBConnectionState>(
    (set, get) => ({
      connections: [],
      getConnections: async () => {
        return get().connections;
      },
      createConnection: async (connection) => {
        const newGraphDBConnection: GraphDBConnection = {
          ...connection
        };
        set((state) => {
          if (state.connections.find(c => c.id === newGraphDBConnection.id)) {
            return state;
          }
          return {
            connections: [...state.connections, newGraphDBConnection],
          };
        });
        return newGraphDBConnection;
      },
      isConnectionNameExists: (name: string) => {
        return get().connections.some((connection) => connection.name === name);
      },
      activeConnectionId: undefined,
      setActiveConnectionId: (id) => {
        console.log("setting active connection", id);
        set(() => ({
          activeConnectionId: id
        }))
      },
      getActiveConnection: () => {
        return get().connections.find((connection) => connection.id === get().activeConnectionId);
      },
      deleteConnections: (connectionIds: string[]) => {
        set((state) => {
          const newConnections = state.connections.filter((connection) => !connectionIds.includes(connection.id));
          let newActiveConnectionId = state.activeConnectionId;
          if (connectionIds.includes(state.activeConnectionId || "")) {
            newActiveConnectionId = undefined;
          }
          return {
            connections: newConnections,
            activeConnectionId: newActiveConnectionId
          }
        })
      },
      deleteAllConnections: () => {
        set(() => ({
          connections: [],
          activeConnectionId: undefined
        }))
      }
    }),
    {
      name: storeName, // Name of the localStorage key
      // getStorage: () => localStorage, // Specify localStorage
    }
  )
)

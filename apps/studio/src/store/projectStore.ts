import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LOCALSTORAGE_KEYS } from '@/constants';
import { ICanvasData } from '@invana/data-store';
import { CanvasManagerOptions } from '@invana/canvas-graph/manager/types';

export interface Project {
  id: string;
  name: string;
  description: string;
  updated_at: Date;
  tags: string[];
  data: ICanvasData;
  options?: CanvasManagerOptions
}

export interface ProjectState {
  projects: Project[];
  getProjects: () => Promise<Project[]>;
  createProject: (project: Project) => Promise<Project>;
  isProjectNameExists: (name: string) => boolean;

  getActiveProject: () => Project | undefined;
  activeProjectId: string | undefined;
  setActiveProjectId: (id: string | undefined) => void;

  deleteProjects: (projectIds: string[]) => void;
  deleteAllProjects: () => void;

}

const storeName = LOCALSTORAGE_KEYS.PROJECT

export const useProjectStore = create(
  persist<ProjectState>(
    (set, get) => ({
      projects: [],
      getProjects: async () => {
        return get().projects;
      },
      createProject: async (project: Project) => {
        if (get().projects.some((p) => p.id === project.id)) {
          console.warn(`Project with id ${project.id} already exists.`);
          return project; // Or throw an error, depending on your needs
        }
        const newProject: Project = {
          ...project
        };
        set((state) => ({
          projects: [...state.projects, newProject],
        }));
        return newProject;
      },
      isProjectNameExists: (name: string) => {
        return get().projects.some((project) => project.name === name);
      },
      activeProjectId: undefined,
      setActiveProjectId: (id) => {
        console.log("setting active project", id);
        set(() => ({
          activeProjectId: id
        }))
      },
      getActiveProject: () => {
        return get().projects.find((project) => project.id === get().activeProjectId);
      },
      deleteProjects: (projectIds: string[]) => {
        set((state) => {
          const newProjects = state.projects.filter((project) => !projectIds.includes(project.id));
          let newActiveProjectId = state.activeProjectId;

          if (projectIds.includes(state.activeProjectId || "")) {
            newActiveProjectId = undefined;
          }
          return {
            projects: newProjects,
            activeProjectId: newActiveProjectId
          }
        })
      },
      deleteAllProjects: () => {
        set(() => ({
          projects: [],
          activeProjectId: undefined
        }))
      }
    }),
    {
      name: storeName, // Name of the localStorage key
      // getStorage: () => localStorage, // Specify localStorage
    }
  )
)

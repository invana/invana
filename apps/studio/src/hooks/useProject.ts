import { useProjectStore } from "@/store/projectStore";



const useProjects = () => {

  const projects = useProjectStore((state) => state.projects);
  const getProjects = useProjectStore((state) => state.getProjects);
  const createProject = useProjectStore((state) => state.createProject);

  const isProjectNameExists = useProjectStore((state) => state.isProjectNameExists);

  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const setActiveProjectId = useProjectStore((state) => state.setActiveProjectId);
  const getActiveProject = useProjectStore((state) => state.getActiveProject);
  const deleteProjects = useProjectStore((state) => state.deleteProjects);
  const deleteAllProjects = useProjectStore((state) => state.deleteAllProjects);

  return {
    projects,
    getProjects,
    createProject,
    isProjectNameExists,
    activeProjectId,
    setActiveProjectId,
    getActiveProject,
    deleteProjects,
    deleteAllProjects
  };
};

export default useProjects;
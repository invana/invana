import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Input } from '@invana/ui';
import { projectsListDataSet } from '../../projectsList';

import React, { useState } from 'react';
import { Database, ChevronDown, Search, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import useProjects from '@/hooks/useProject';
import { Project } from '@/store/projectStore';



export const ProjectSwitcher: React.FC = () => {


  const { projects, setActiveProjectId, getActiveProject, createProject } = useProjects()

  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("")

  const filteredProjects: Project[] = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const navigateToLanding = (project: Project) => {
    setActiveProjectId(project.id)
    // navigate(LANDING_ROUTE)
  }


  const activeProject = getActiveProject()


  React.useEffect(() => {
    projectsListDataSet.map((project) => {
      createProject(project)
    })
    if (!activeProject) {
      setActiveProjectId(projectsListDataSet[0].id)
    }
    if (activeProject) {
      navigate(`/graph/${activeProject?.id}`)
    }
  }, [])


  return (
    <div>
      {projectsListDataSet.length > 0 ?
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2 ">
              {/* <Database className=" h-4 " /> */}
              <span >{activeProject?.name || "select a project"}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56  ">
            <DropdownMenuLabel>Switch a project</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>
            <DropdownMenuSeparator />
            {filteredProjects.map((Project) => (
              <DropdownMenuItem
                key={Project.id}
                onClick={() => navigateToLanding(Project)}
                className="cursor-pointer"
              ><Database className=" h-4 " />
                {Project.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <Link to={"/connect?newProject=true"} className="inline-flex">
                <Plus className="mr-2 h-4 w-4" />Add Project
              </Link>
            </DropdownMenuItem>


          </DropdownMenuContent>
        </DropdownMenu>
        : <></>}
    </div>
  );
};


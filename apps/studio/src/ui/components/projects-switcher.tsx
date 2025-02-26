import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Input } from '@invana/ui';
import { projectsListDataSet } from '../../projectsList';

import React, { useState } from 'react';
import { ChevronDown, Search, Box, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useProjects from '@/hooks/useProject';
import { Project } from '@/store/projectStore';
import { LANDING_ROUTE } from '@/constants';


export const ProjectSwitcher: React.FC = () => {

  const { projects, setActiveProjectId, getActiveProject } = useProjects()
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("")

  const filteredProjects: Project[] = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const navigateToLanding = (project: Project) => {
    setActiveProjectId(project.id)
    navigate(`/graph/${project?.id}`)
    window.location.reload();
  }

  const activeProject = getActiveProject()

  const closeProject = () => {
    setActiveProjectId(undefined);
    navigate(LANDING_ROUTE)
    window.location.reload();
  }

  return (
    <div>
      {projectsListDataSet.length > 0 ?
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex text-sm bg-transparent items-center space-x-1">
              {/* <Box className=" h-4 " /> */}
              <span>
                {activeProject?.name || "select a graph"}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-260 ">
            <DropdownMenuLabel>Switch graph</DropdownMenuLabel>
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
              ><Box className=" h-4 " />
                {Project.name}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator className='mt-2' />
            <DropdownMenuItem className="cursor-pointer mt-2"
              onClick={() => closeProject()}
            >
              <LogOut className=' h-4' /> Leave Graph
              {/* <Link to={"/connect?newProject=true"} className="inline-flex">
                <Plus className="mr-2 h-4 w-4" />Add Project
              </Link> */}
            </DropdownMenuItem>

            {/* <DropdownMenuSeparator /> */}
            {/* <DropdownMenuItem className="cursor-pointer">
              <Link to={"/connect?newProject=true"} className="inline-flex">
                <Plus className="mr-2 h-4 w-4" />Add Project
              </Link>
            </DropdownMenuItem> */}


          </DropdownMenuContent>
        </DropdownMenu>
        : <></>}
    </div>
  );
};


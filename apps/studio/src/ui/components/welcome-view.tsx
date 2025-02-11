
import { Button, Card } from '@invana/ui';
import { Badge, BookOpenIcon, LightbulbIcon } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ILearnMoreItem } from '@/pages/connect/connect';
import useProjects from '@/hooks/useProject';
import { Project } from '@/store/projectStore';
import useConnections from '@/hooks/useConnection';


const learnMoreItems: ILearnMoreItem[] = [
  {
    title: "Get Started with Invana Studio",
    description: "Modelling graphs, querying, visualisations",
    badge: null,
    icon: LightbulbIcon
  },
  {
    title: "Learn the Fundamentals",
    description: null,
    badge: null,
    icon: BookOpenIcon
  },
  {
    title: "Get started with Python Development",
    description: null,
    badge: <Badge className="bg-blue-500 text-white">Updated</Badge>,
    icon: BookOpenIcon
  }
]

const WelcomeView: React.FC = () => {

  const { projects, setActiveProjectId } = useProjects()
  const { getActiveConnection } = useConnections()
  const navigate = useNavigate();

  const switchToProject = (project: Project) => {
    setActiveProjectId(project.id)
    navigate(`/graph/${project?.id}`)
    window.location.reload();
  }

  const activeConnection = getActiveConnection()

  return (
    <div className="max-w-6xl mx-auto space-y-6 mt-[7%]">
      <div>
        <h1 className="text-4xl font-semibold">Welcome to {activeConnection?.name}</h1>
        {/* <h2 className="text-2xl font-light">
          An opensource Thinkers toolkit for curious people.
        </h2>
        <p className='text-zinc-500 mt-3'>Taxonomies | Ontologies | Knowledge Graphs and more.</p> */}
      </div>

      <div className="grid md:grid-cols-2 gap-16" >
        {/* Start Section */}
        <div className="space-y-6">
          <div>
            <h3 className="mb-4 text-lg"> Recent graphs</h3>
            <div className="space-y-2">
              {projects.length === 0 ? (
                <p className="text-zinc-500">There are no connections.</p>
              ) : (
                projects.slice(-5).map((project: Project, index: number) => (
                  <div key={index} className="group">
                    <div className="flex justify-between items-center">
                      <Button variant={"ghost"} onClick={() => switchToProject(project)}
                        className="w-full justify-start p-0 hover:bg-transparent text-blue-500 dark:text-blue-400 hover:text-blue-300">
                        {project.name}
                      </Button>
                    </div>
                    <p className="text-xs text-zinc-500">{project.description}</p>
                  </div>
                ))
              )}

              {/* <Button variant={"ghost"} onClick={() => setShowForm(true)} className="w-full justify-start p-0 hover:bg-transparent">
                <Link /> Create a new connection
              </Button> */}
            </div>
          </div>
        </div>

        {/* Walkthroughs Section */}
        <div>
          <h3 className="text-lg mb-4">Learn more</h3>
          <div className="space-y-2">
            {learnMoreItems.map((item, index) => (
              <Card key={index} className="bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 transition-colors cursor-pointer">
                <Button variant="ghost" className="w-full justify-start p-4 h-auto">
                  <item.icon className="mr-4 h-5 w-5 text-blue-400" />
                  <div className="text-left ">
                    <div className="font-medium text-white">{item.title}</div>
                    {item.description && (
                      <div className="text-sm text-zinc-400">{item.description}</div>
                    )}
                    {/* {item?.badge} */}
                  </div>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeView;
import React from 'react';
import { Button, Card, BlankLayout, useThemeStore, Tooltip, TooltipContent, TooltipTrigger } from '@invana/ui';
import {
  Badge,
  BookOpenIcon, Database, LightbulbIcon,
  Link,
  Trash,
} from 'lucide-react';
import { LANDING_ROUTE } from '../../constants';
// import { useConnectionStore } from '../../store/connectionStore';
import { GraphDBConnection } from '../../models';
import { ConnectForm } from '../../ui/forms/connect-form';
import { LogoComponent } from '../constants';
import useConnections from '@/hooks/useConnection';
import { projectsListDataSet } from '@/projectsList';
import useProjects from '@/hooks/useProject';
import { useNavigate } from 'react-router-dom';


export interface ILearnMoreItem {
  title: string;
  icon: React.ElementType
  description?: string | null;
  badge?: React.ReactNode | null;
}
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

const ConnectPage: React.FC = () => {

  const { createProject, setActiveProjectId, deleteAllProjects } = useProjects()
  const navigate = useNavigate();

  const { initTheme } = useThemeStore();
  const { connections, setActiveConnectionId, createConnection, deleteConnections } = useConnections();
  const [showForm, setShowForm] = React.useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('newConnection') === 'true';
  });

  const switchToConnection = (connectionId: string) => {
    setActiveConnectionId(connectionId);

    // delete all projects before switching to a new connection
    deleteAllProjects();
    // add example 
    projectsListDataSet.map((project) => {
      createProject(project)
    })
    if (projectsListDataSet.length > 0) {
      // const project = projectsListDataSet[0]
      // setActiveProjectId(project?.id)
      // navigate(`/graph/${project?.id}`)
      navigate(LANDING_ROUTE)
    } else {
      window.location.href = LANDING_ROUTE;
    }
  }

  React.useEffect(() => {
    // Check if there are any existing connections
    // Create a default "Hello World" connection
    const helloWorldConnection: GraphDBConnection = {
      id: 'examples-101',
      name: 'examples-101',
      hosturl: 'localhost:8182',
      queryLanguage: 'gremlin',
      username: '',
      password: '',
    };
    createConnection(helloWorldConnection)
  }, []);

  initTheme()

  return (
    <BlankLayout logo={LogoComponent} topNavItems={[]} bottomNavItems={[]}>
      <div className="min-h-screen p-4">

        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <a href="https://github.com/invana/invana-studio" target="_blank" className="ml-2 mr-2">
                <img src="https://img.shields.io/github/stars/invana/invana-studio?style=social"
                  alt="stars" className="  w-20 " />
              </a>
            </TooltipTrigger>
            <TooltipContent>Star or Fork this project</TooltipContent>
          </Tooltip>
        </div>
        <div className="max-w-6xl mx-auto space-y-6 mt-[7%]">
          <div>
            <h1 className="text-4xl font-semibold">Invana Studio</h1>
            <h2 className="text-2xl font-light">
              An opensource Thinkers toolkit for curious people.
            </h2>
            <p className='text-zinc-500 mt-3'>Taxonomies | Ontologies | Knowledge Graphs and more.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-16" >
            {/* Start Section */}
            <div className="space-y-6">
              <div>
                {showForm && <ConnectForm setShowForm={setShowForm} />}
              </div>
              <div>
                <h3 className="mb-4 text-lg"> Recent Connections</h3>
                <div className="space-y-2">
                  {connections.length === 0 ? (
                    <p className="text-zinc-500">There are no connections.</p>
                  ) : (
                    connections.slice(-5).map((connection: GraphDBConnection, index: number) => (
                      <div key={index} className="group">
                        <div className="flex justify-between items-center">
                          <Button variant={"ghost"} onClick={() => switchToConnection(connection.id)}
                            className="w-full justify-start p-0 hover:bg-transparent text-blue-500 dark:text-blue-400 hover:text-blue-300">
                            <Database /> {connection.name} - [{connection.queryLanguage}]
                          </Button>
                          <Button variant={"ghost"} onClick={() => {
                            console.log("deleting connection", connection.id);
                            deleteConnections([connection.id])
                          }}
                            className="  p-0 hover:bg-transparent text-muted-500   hover:text-red-300">
                            <Trash className='w-4 h-4' />
                          </Button>
                        </div>
                        <p className="text-xs text-zinc-500">{connection.hosturl}</p>
                      </div>
                    ))
                  )}

                  <Button variant={"ghost"} onClick={() => setShowForm(true)} className="w-full justify-start p-0 hover:bg-transparent">
                    <Link /> Create a new connection
                  </Button>
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
      </div>
    </BlankLayout>
  );
};

export default ConnectPage;
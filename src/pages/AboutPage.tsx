import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Wrench, ShieldCheck, Lightbulb, Users, Clock } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const characteristics = [
  {
    icon: <Lightbulb className="h-6 w-6" />,
    title: 'Intangibilidade',
    description: 'Não há itens físicos envolvidos na transação. O contratante não é dono do serviço prestado — ele recebe o resultado do trabalho.',
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: 'Simultaneidade',
    description: 'O serviço é executado e entregue ao cliente de forma simultânea. O combinado é realizado e pago ao mesmo tempo ou na sequência.',
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: 'Exclusividade',
    description: 'Todo serviço é único. Sua realização e resultado variam de acordo com as circunstâncias e os envolvidos.',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Inseparabilidade',
    description: 'A interação entre contratante e contratado se mantém desde o primeiro contato até a conclusão do trabalho.',
  },
  {
    icon: <Wrench className="h-6 w-6" />,
    title: 'Personalização',
    description: 'É possível fazer adaptações na contratação em tempo real, de acordo com as necessidades específicas do cliente.',
  },
];

const serviceTypes = [
  { emoji: '💆', name: 'Serviços Pessoais', desc: 'Esteticistas, cabeleireiros, massagistas e outros profissionais que atendem necessidades pessoais.' },
  { emoji: '⚖️', name: 'Serviços Especializados', desc: 'Advogados, consultores e profissionais com habilidades técnicas específicas.' },
  { emoji: '🏥', name: 'Serviços de Saúde', desc: 'Médicos, nutricionistas, fisioterapeutas e outros profissionais da área da saúde.' },
  { emoji: '📚', name: 'Serviços Educacionais', desc: 'Professores particulares, tutores e instrutores de idiomas.' },
  { emoji: '🚗', name: 'Serviços de Transporte', desc: 'Motoristas, motoboys e ciclistas que movimentam pessoas ou entregam produtos.' },
  { emoji: '💻', name: 'Serviços Tecnológicos', desc: 'Desenvolvedores, técnicos de informática e especialistas em TI.' },
  { emoji: '🛡️', name: 'Serviços de Segurança', desc: 'Segurança patrimonial, pessoal, de eventos e monitoramento por câmeras.' },
  { emoji: '💰', name: 'Serviços Financeiros', desc: 'Contadores, consultores de investimento e operações bancárias.' },
  { emoji: '🧹', name: 'Serviços de Limpeza', desc: 'Profissionais especializados na higienização de itens ou ambientes.' },
  { emoji: '✈️', name: 'Serviços de Turismo', desc: 'Guias turísticos, agentes de viagem e serviços de hospedagem.' },
];

const exampleProviders = [
  'Consultor empresarial', 'Cabeleireiro', 'Contador', 'Profissional de transporte de carga',
  'Desenvolvedor de software', 'Mecânico de veículos', 'Faxineiro', 'Segurança',
  'Assistente técnico', 'Radiologista', 'Produtor de conteúdo', 'Marketing digital',
  'Organizador de eventos', 'Advogado', 'Professor particular', 'Entregador',
  'Eletricista', 'Designer gráfico', 'Psicólogo', 'Guia de turismo',
  'Jardineiro', 'Produtor audiovisual', 'Assessor de imprensa', 'Tradutor',
  'Intérprete', 'Fotógrafo', 'Filmmaker', 'Web Designer',
  'Montador de móveis', 'Babá', 'Passeador de cães', 'Limpador de vidros',
  'Sapateiro', 'Cuidador de idosos', 'Manicure', 'Bicicleteiro',
  'Encanador', 'Costureiro(a)', 'Motorista escolar', 'Instalador de ar-condicionado',
  'Cerimonialista', 'Banhista de animais', 'Editor de vídeo', 'Pintor',
  'Pedreiro', 'Consultor de moda', 'Corretor de seguros', 'Recreador infantil',
  'Detetive particular', 'Marceneiro',
];

const AboutPage = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <section className="bg-hero py-16 md:py-24">
        <div className="container relative z-10 text-center">
          <motion.h1
            {...fadeIn}
            className="font-display text-3xl font-extrabold tracking-tight text-primary-foreground md:text-5xl"
          >
            O que é prestação de serviço?
          </motion.h1>
          <motion.p
            {...fadeIn}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/70"
          >
            Entenda tudo sobre o universo dos serviços, tipos de profissionais e como encontrar o prestador ideal para as suas necessidades.
          </motion.p>
        </div>
      </section>

      {/* Definition */}
      <section className="py-16">
        <div className="container max-w-3xl">
          <motion.div {...fadeIn} className="space-y-5 text-foreground">
            <h2 className="font-display text-2xl font-bold md:text-3xl">Entendendo a prestação de serviço</h2>
            <p className="text-muted-foreground leading-relaxed">
              Qualquer atividade econômica em que alguém atende a um chamado de outra pessoa <strong className="text-foreground">sem que seja necessário vender produtos</strong> — prestando exclusivamente algum tipo de serviço — é chamada de <em>"prestação de serviço"</em>.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Na compra de produtos há a transferência de propriedade de um item entre quem vende e quem adquire. Na prestação de serviço, o prestador dedica <strong className="text-foreground">tempo, esforço e conhecimento</strong> para resolver um problema do contratante.
            </p>
            <div className="rounded-xl border border-border bg-muted/50 p-5">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Exemplo prático:</strong> Quando você compra pneus novos para o carro, está adquirindo itens com um vendedor. Por outro lado, se alguém entrega os pneus no seu endereço ou se alguém os troca, você está contratando um <span className="text-accent font-semibold">prestador de serviço</span>.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 5 Characteristics */}
      <section className="bg-muted/50 py-16">
        <div className="container">
          <motion.div {...fadeIn} className="mb-10 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              5 características básicas da prestação de serviço
            </h2>
            <p className="mt-2 text-muted-foreground">
              Se os serviços são "coisas" intangíveis, contratadas e consumidas de forma simultânea, exclusivas e inseparáveis — uma prestação de serviço é tudo isso colocado em ação.
            </p>
          </motion.div>
          <div className="grid gap-4 md:grid-cols-5">
            {characteristics.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-xl border border-border bg-card p-5 shadow-card text-center"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  {item.icon}
                </div>
                <h3 className="font-display text-sm font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Types */}
      <section className="py-16">
        <div className="container">
          <motion.div {...fadeIn} className="mb-10 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              Quais são os tipos de prestação de serviço?
            </h2>
            <p className="mt-2 max-w-2xl mx-auto text-muted-foreground">
              Alguns dos tipos mais conhecidos no Brasil são: especializados, públicos, financeiros, pessoais e tecnológicos. Conheça todos:
            </p>
          </motion.div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {serviceTypes.map((type, i) => (
              <motion.div
                key={type.name}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <span className="text-2xl">{type.emoji}</span>
                <h3 className="mt-2 font-display text-sm font-bold text-foreground">{type.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{type.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 50 Examples */}
      <section className="bg-muted/50 py-16">
        <div className="container">
          <motion.div {...fadeIn} className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              50 exemplos de prestadores de serviço
            </h2>
            <p className="mt-2 text-muted-foreground">
              A quantidade de profissionais disponíveis para atender no Brasil é surpreendente. Explore alguns:
            </p>
          </motion.div>
          <div className="flex flex-wrap justify-center gap-2">
            {exampleProviders.map((name) => (
              <span
                key={name}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="py-16">
        <div className="container max-w-3xl space-y-5">
          <motion.div {...fadeIn}>
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              Sempre tem alguém precisando — e alguém pronto para ajudar
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              O segredo é pesquisar bem, pedir indicações e dialogar com o prestador de forma transparente, deixando claras suas necessidades e possibilidades.
            </p>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Da mesma maneira, cabe ao profissional expressar tudo aquilo que é capaz de fazer, elaborando uma proposta comercial completa e adequada, dando sugestões coerentes e sempre alinhando expectativas.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-hero py-16">
        <div className="container text-center">
          <h2 className="font-display text-2xl font-bold text-primary-foreground md:text-3xl">
            Encontre o profissional ideal agora
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-primary-foreground/70">
            Na <strong>Preciso de um</strong>, você encontra prestadores de serviço verificados e avaliados por outros clientes.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button variant="hero" size="xl" className="rounded-full" asChild>
              <Link to="/buscar">Buscar Profissional <ArrowRight className="h-5 w-5" /></Link>
            </Button>
            <Button variant="outline" size="xl" className="rounded-full border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/cadastro">Sou Profissional</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutPage;

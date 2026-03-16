const faqs = [
  { q: 'Como encontro um profissional?', a: 'Use a barra de busca para pesquisar pelo serviço e sua cidade. Você verá uma lista de profissionais verificados com avaliações.' },
  { q: 'O cadastro é gratuito?', a: 'Sim! Profissionais podem se cadastrar gratuitamente no plano básico. Planos PRO e Premium oferecem mais visibilidade.' },
  { q: 'Como funciona a avaliação?', a: 'Após contratar um serviço, você pode avaliar o profissional com notas de 1 a 5 estrelas em qualidade, pontualidade e atendimento.' },
  { q: 'É seguro contratar pela plataforma?', a: 'Todos os profissionais passam por verificação. Além disso, as avaliações de outros clientes ajudam na sua decisão.' },
];

const FaqSection = () => (
  <section className="bg-muted/50 py-14">
    <div className="container max-w-2xl">
      <h2 className="mb-8 text-center font-display text-2xl font-bold text-foreground md:text-3xl">Perguntas Frequentes</h2>
      {faqs.map((faq, i) => (
        <details key={i} className="group mb-3 rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">
            {faq.q}
          </summary>
          <p className="px-5 pb-4 text-sm text-muted-foreground">{faq.a}</p>
        </details>
      ))}
    </div>
  </section>
);

export default FaqSection;

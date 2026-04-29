export interface ServiceCountdownCopy {
  title: string;
  subtitle: string;
}

/** Devolve "1º", "2º"… (português, masculino). */
export const ordinalPt = (n: number): string => `${n}º`;

/** Mensagem contextual de contagem expressa para criação de novo serviço. */
export function buildServiceCountdownCopy(current: number, max: number): ServiceCountdownCopy {
  const remainingAfter = Math.max(0, max - current);

  if (current <= 1) {
    return {
      title: 'Seu 1º serviço — vamos começar!',
      subtitle: `Você poderá cadastrar até ${max} no total.`,
    };
  }

  if (current === 2) {
    return {
      title: `Você está cadastrando seu ${ordinalPt(current)} serviço`,
      subtitle: `Depois deste, ainda restam ${remainingAfter} cadastros disponíveis.`,
    };
  }

  if (current === 3) {
    return {
      title: `Você está cadastrando seu ${ordinalPt(current)} serviço`,
      subtitle: `Seu portfólio está ganhando força. Depois deste, restam ${remainingAfter} cadastros disponíveis.`,
    };
  }

  if (current === max - 1) {
    return {
      title: 'Penúltimo serviço — falta só 1 depois deste',
      subtitle: `Após finalizar, restará ${remainingAfter} cadastro disponível.`,
    };
  }

  if (current >= max) {
    return {
      title: `Último serviço — após este você terá ${max} anúncios ativos`,
      subtitle: 'Capricha! Esse é o fechamento do seu portfólio.',
    };
  }

  return {
    title: `Você está cadastrando seu ${ordinalPt(current)} serviço`,
    subtitle: `Depois deste, ainda restam ${remainingAfter} cadastros disponíveis.`,
  };
}
import PDFDocument from 'pdfkit';
import db from '../config/database.js';

export async function generateReceipt(vendaId) {
  return new Promise((resolve, reject) => {
    try {
      const venda = db.prepare(`
        SELECT v.*, c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone,
               c.cpf as cliente_cpf, c.endereco as cliente_endereco, c.cidade as cliente_cidade,
               c.estado as cliente_estado
        FROM vendas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.id = ?
      `).get(vendaId);

      if (!venda) {
        throw new Error('Venda não encontrada');
      }

      const storeSettings = db.prepare(`
        SELECT * FROM configuracoes_loja WHERE usuario_id = ?
      `).get(venda.usuario_id);

      const storeName = storeSettings?.nome_loja || 'Minha Loja';
      const storeCnpj = storeSettings?.cnpj || '';
      const storeAddress = storeSettings?.endereco || '';
      const storePhone = storeSettings?.telefone || '';
      const storeEmail = storeSettings?.email_contato || '';
      const receiptMessage = storeSettings?.mensagem_recibo || 'Obrigado pela preferência!';

      const produtos = JSON.parse(venda.produtos);

      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(storeName.toUpperCase(), { align: 'center' })
        .moveDown(0.3);

      if (storeCnpj) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(`CNPJ: ${formatCnpj(storeCnpj)}`, { align: 'center' });
      }

      if (storeAddress) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(storeAddress, { align: 'center' });
      }

      const contactInfo = [];
      if (storePhone) contactInfo.push(`Tel: ${storePhone}`);
      if (storeEmail) contactInfo.push(`Email: ${storeEmail}`);
      
      if (contactInfo.length > 0) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(contactInfo.join(' | '), { align: 'center' });
      }

      doc.moveDown(1);

      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .lineWidth(2)
        .stroke()
        .moveDown(0.5);

      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('RECIBO DE VENDA', { align: 'center' })
        .moveDown(0.5);

      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .lineWidth(1)
        .stroke()
        .moveDown();

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('DADOS DA VENDA', { underline: true })
        .moveDown(0.3);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Nº da Venda: #${String(venda.id).padStart(6, '0')}`)
        .text(`Data: ${new Date(venda.data_venda).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`)
        .moveDown();

      if (venda.cliente_nome) {
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('DADOS DO CLIENTE', { underline: true })
          .moveDown(0.3);

        doc
          .fontSize(10)
          .font('Helvetica')
          .text(`Nome: ${venda.cliente_nome}`);
        
        if (venda.cliente_cpf) {
          doc.text(`CPF: ${formatCpf(venda.cliente_cpf)}`);
        }
        if (venda.cliente_telefone) {
          doc.text(`Telefone: ${venda.cliente_telefone}`);
        }
        if (venda.cliente_email) {
          doc.text(`Email: ${venda.cliente_email}`);
        }
        if (venda.cliente_endereco) {
          let enderecoCompleto = venda.cliente_endereco;
          if (venda.cliente_cidade) {
            enderecoCompleto += `, ${venda.cliente_cidade}`;
          }
          if (venda.cliente_estado) {
            enderecoCompleto += ` - ${venda.cliente_estado}`;
          }
          doc.text(`Endereço: ${enderecoCompleto}`);
        }
        doc.moveDown();
      }

      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('ITENS DA VENDA', { underline: true })
        .moveDown(0.5);

      const tableTop = doc.y;
      const colWidths = { produto: 180, qtd: 50, precoUnit: 90, total: 90 };
      const colPos = { produto: 50, qtd: 240, precoUnit: 310, total: 420 };

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('PRODUTO', colPos.produto, tableTop, { width: colWidths.produto })
        .text('QTD', colPos.qtd, tableTop, { width: colWidths.qtd, align: 'center' })
        .text('PREÇO UNIT.', colPos.precoUnit, tableTop, { width: colWidths.precoUnit, align: 'right' })
        .text('SUBTOTAL', colPos.total, tableTop, { width: colWidths.total, align: 'right' });

      doc.moveDown(0.3);
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.5);

      doc.font('Helvetica').fontSize(9);
      
      let subtotal = 0;
      for (const item of produtos) {
        const produtoEstoque = db.prepare('SELECT produto, preco_unitario, preco_venda FROM estoque WHERE id = ?').get(item.produto_id);
        const nomeProduto = produtoEstoque ? produtoEstoque.produto : `Produto ${item.produto_id}`;
        const precoUnit = item.preco_unitario || item.preco_venda || (produtoEstoque ? (produtoEstoque.preco_venda || produtoEstoque.preco_unitario) : 0);
        const totalItem = precoUnit * item.quantidade;
        subtotal += totalItem;

        const y = doc.y;
        doc
          .text(nomeProduto.substring(0, 35), colPos.produto, y, { width: colWidths.produto })
          .text(item.quantidade.toString(), colPos.qtd, y, { width: colWidths.qtd, align: 'center' })
          .text(`R$ ${precoUnit.toFixed(2)}`, colPos.precoUnit, y, { width: colWidths.precoUnit, align: 'right' })
          .text(`R$ ${totalItem.toFixed(2)}`, colPos.total, y, { width: colWidths.total, align: 'right' });

        doc.moveDown(0.5);
      }

      doc
        .moveDown(0.3)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.5);

      const summaryX = 350;
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Subtotal:`, summaryX, doc.y, { continued: true, width: 100 })
        .text(`R$ ${subtotal.toFixed(2)}`, { align: 'right', width: 100 })
        .moveDown(0.3);

      if (venda.desconto && parseFloat(venda.desconto) > 0) {
        doc
          .text(`Desconto:`, summaryX, doc.y, { continued: true, width: 100 })
          .text(`- R$ ${parseFloat(venda.desconto).toFixed(2)}`, { align: 'right', width: 100 })
          .moveDown(0.3);
      }

      doc.moveDown(0.2);
      doc
        .moveTo(summaryX, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.3);

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`TOTAL: R$ ${parseFloat(venda.valor_total).toFixed(2)}`, { align: 'right' })
        .moveDown(0.5);

      if (venda.forma_pagamento) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(`Forma de Pagamento: ${formatPaymentMethod(venda.forma_pagamento)}`, { align: 'right' })
          .moveDown();
      }

      doc.moveDown(2);

      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .lineWidth(0.5)
        .stroke()
        .moveDown();

      doc
        .fontSize(11)
        .font('Helvetica-Oblique')
        .text(receiptMessage, { align: 'center' })
        .moveDown(0.5);

      doc
        .fontSize(8)
        .font('Helvetica')
        .text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' })
        .text(`${storeName} - Todos os direitos reservados`, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function formatCnpj(cnpj) {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatCpf(cpf) {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function formatPaymentMethod(method) {
  const methods = {
    'dinheiro': 'Dinheiro',
    'cartao_credito': 'Cartão de Crédito',
    'cartao_debito': 'Cartão de Débito',
    'pix': 'PIX',
    'boleto': 'Boleto',
    'transferencia': 'Transferência Bancária',
    'credito': 'Cartão de Crédito',
    'debito': 'Cartão de Débito'
  };
  return methods[method?.toLowerCase()] || method || 'Não informado';
}

export default { generateReceipt };

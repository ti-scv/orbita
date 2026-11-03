// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach} from "vitest";
import {render,screen,waitFor,cleanup} from "@testing-library/react";
import PatientChat,{formatCpf} from "./PatientChat";
import {canAccess} from "../permissions";
import {readRoute,routePath} from "../routes";
afterEach(()=>{cleanup();vi.unstubAllGlobals();sessionStorage.clear();history.replaceState(null,'','/')});
describe('Autoagendamento Sansaúde',()=>{
 it('preserva máscara do CPF',()=>{expect(formatCpf('37436716468')).toBe('374.367.164-68');expect(formatCpf('1234')).toBe('123.4')});
 it('reserva rota administrativa e acesso apenas para Sansaúde',()=>{expect(readRoute('/autoagendamento').page).toBe('autoagenda');expect(routePath('autoagenda')).toBe('/autoagendamento');const s:any={units:[{slug:'ame'},{slug:'sansaude'}],roles:{ame:'admin',sansaude:'admin'}};expect(canAccess(s,'ame','autoagenda')).toBe(false);expect(canAccess(s,'sansaude','autoagenda')).toBe(true)});
 it('reproduz cabeçalho visual sem Assistente virtual e bloqueia link ausente',async()=>{render(<PatientChat/>);await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Abra o link'));expect(screen.getByAltText('Sansaúde')).toBeTruthy();expect(screen.getByText('Agendamento de Consultas')).toBeTruthy();expect(screen.queryByText('Assistente virtual')).toBeNull()});
 it('resgata link uma única vez e usa API sem PHP',async()=>{history.replaceState(null,'','/#ticket=example');const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({session_token:'isolated-test-session',version:2,state:'active',step:'cpf',input:'cpf',events:[{id:1,actor:'bot',text:'Informe o CPF.'}],environment:'homologation'})});vi.stubGlobal('fetch',fetcher);render(<PatientChat/>);await screen.findByLabelText('CPF do paciente');expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toBe('/api/v1/autoagenda/public/');expect(sessionStorage.getItem('scv-autoagenda-token')).toBe('isolated-test-session');expect(location.hash).toBe('');expect(screen.getByText('HOMOLOGAÇÃO')).toBeTruthy()});
});

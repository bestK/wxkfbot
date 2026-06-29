/**
 * 客服管理API路由处理
 */
import { KFManagement } from './kf-management.js';
import { DebugLogger } from './debug-logger.js';
import { ApiResponse } from './response.js';

export function createKFRouter(env) {
    const kf = new KFManagement(env.WECHAT_CORP_ID, env.WECHAT_KF_SECRET);
    return kf;
}

function getLogger(env) {
    return new DebugLogger(env.CONVERSATIONS);
}

/**
 * 客服帐号管理路由
 */
export async function handleKFAccountList(env) {
    try {
        const kf = createKFRouter(env);
        const result = await kf.listAccounts();
        return ApiResponse.success(result, '获取客服帐号列表成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取客服帐号列表失败: ${error.message}`);
        return ApiResponse.internalError('获取客服帐号列表失败', { error: error.message });
    }
}

export async function handleKFAccountAdd(request, env) {
    try {
        const body = await request.json();
        if (!body.name) {
            return ApiResponse.badRequest('缺少客服名称参数 name');
        }
        const kf = createKFRouter(env);
        const result = await kf.addAccount(body.name, body.media_id);
        return ApiResponse.success(result, '添加客服帐号成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `添加客服帐号失败: ${error.message}`);
        return ApiResponse.internalError('添加客服帐号失败', { error: error.message });
    }
}

export async function handleKFAccountUpdate(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid) {
            return ApiResponse.badRequest('缺少客服ID参数 open_kfid');
        }
        const kf = createKFRouter(env);
        const result = await kf.updateAccount(body.open_kfid, body.name, body.media_id);
        return ApiResponse.success(result, '修改客服帐号成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `修改客服帐号失败: ${error.message}`);
        return ApiResponse.internalError('修改客服帐号失败', { error: error.message });
    }
}

export async function handleKFAccountDelete(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid) {
            return ApiResponse.badRequest('缺少客服ID参数 open_kfid');
        }
        const kf = createKFRouter(env);
        const result = await kf.deleteAccount(body.open_kfid);
        return ApiResponse.success(result, '删除客服帐号成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `删除客服帐号失败: ${error.message}`);
        return ApiResponse.internalError('删除客服帐号失败', { error: error.message });
    }
}

export async function handleKFContactWay(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid || !body.scene) {
            return ApiResponse.badRequest('缺少参数 open_kfid 或 scene');
        }
        const kf = createKFRouter(env);
        const result = await kf.getContactWay(body.open_kfid, body.scene);
        return ApiResponse.success(result, '获取客服链接成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取客服链接失败: ${error.message}`);
        return ApiResponse.internalError('获取客服链接失败', { error: error.message });
    }
}

export async function handleKFServiceState(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid || !body.external_userid) {
            return ApiResponse.badRequest('缺少参数 open_kfid 或 external_userid');
        }
        const kf = createKFRouter(env);
        const result = await kf.getServiceState(body.open_kfid, body.external_userid);
        return ApiResponse.success(result, '获取会话状态成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取会话状态失败: ${error.message}`);
        return ApiResponse.internalError('获取会话状态失败', { error: error.message });
    }
}

export async function handleKFServiceStateTrans(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid || !body.external_userid || body.service_state === undefined) {
            return ApiResponse.badRequest('缺少参数');
        }
        const kf = createKFRouter(env);
        const result = await kf.transServiceState(body.open_kfid, body.external_userid, body.service_state, body.servicer_userid);
        return ApiResponse.success(result, '转接会话成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `转接会话失败: ${error.message}`);
        return ApiResponse.internalError('转接会话失败', { error: error.message });
    }
}

export async function handleKFSendMessage(request, env) {
    let body;
    try {
        body = await request.json();
        if (!body.touser || !body.open_kfid || !body.msgtype) {
            return ApiResponse.badRequest('缺少参数 touser, open_kfid 或 msgtype');
        }
        const kf = createKFRouter(env);
        const result = await kf.request('POST', '/kf/send_msg', body);
        return ApiResponse.success(result, '发送消息成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `发送消息失败: ${error.message}`, {
            touser: body?.touser,
            open_kfid: body?.open_kfid,
            msgtype: body?.msgtype,
        });
        return ApiResponse.internalError('发送消息失败', { error: error.message });
    }
}

export async function handleKFSyncMsg(request, env) {
    try {
        const body = await request.json();
        const kf = createKFRouter(env);
        const result = await kf.syncMessages(body.cursor, body.token, body.limit, body.voice_format, body.open_kfid);
        return ApiResponse.success(result, '同步消息成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `同步消息失败: ${error.message}`);
        return ApiResponse.internalError('同步消息失败', { error: error.message });
    }
}

export async function handleKFSentMessages(request, env) {
    if (!env.CONVERSATIONS) {
        return ApiResponse.internalError('KV 未配置');
    }
    try {
        const body = await request.json();
        const { open_kfid, external_userid } = body;
        if (!open_kfid || !external_userid) {
            return ApiResponse.badRequest('缺少参数 open_kfid 或 external_userid');
        }
        const key = `__SENT_MSG__${open_kfid}__${external_userid}`;
        const raw = await env.CONVERSATIONS.get(key, 'json');
        return ApiResponse.success({ msg_list: raw || [] });
    } catch (error) {
        return ApiResponse.internalError('获取已发消息失败', { error: error.message });
    }
}

export async function handleKFCustomerInfo(request, env) {
    try {
        const body = await request.json();
        if (!body.external_userid_list || !Array.isArray(body.external_userid_list)) {
            return ApiResponse.badRequest('缺少参数 external_userid_list');
        }
        const kf = createKFRouter(env);
        const result = await kf.batchGetCustomers(body.external_userid_list, body.need_enter_scene_info);
        return ApiResponse.success(result, '获取客户信息成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取客户信息失败: ${error.message}`);
        return ApiResponse.internalError('获取客户信息失败', { error: error.message });
    }
}

export async function handleKFStatistics(request, env) {
    try {
        const body = await request.json();
        if (!body.open_kfid || !body.start_time || !body.end_time) {
            return ApiResponse.badRequest('缺少参数 open_kfid, start_time 或 end_time');
        }
        const kf = createKFRouter(env);
        const result = await kf.getStatistics(body.open_kfid, body.start_time, body.end_time);
        return ApiResponse.success(result, '获取统计数据成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取统计数据失败: ${error.message}`);
        return ApiResponse.internalError('获取统计数据失败', { error: error.message });
    }
}

export async function handleKFRecallMsg(request, env) {
    try {
        const body = await request.json();
        if (!body.msgid) {
            return ApiResponse.badRequest('缺少参数 msgid');
        }
        const kf = createKFRouter(env);
        const result = await kf.recallMessage(body.msgid, body.open_kfid);
        return ApiResponse.success(result, '撤回消息成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `撤回消息失败: ${error.message}`);
        return ApiResponse.internalError('撤回消息失败', { error: error.message });
    }
}

export async function handleKFMediaProxy(request, env) {
    try {
        const url = new URL(request.url);
        const mediaId = url.searchParams.get('media_id');
        if (!mediaId) {
            return ApiResponse.badRequest('缺少参数 media_id');
        }
        const kf = createKFRouter(env);
        const mediaUrl = await kf.getMediaUrl(mediaId);
        const resp = await fetch(mediaUrl);
        if (!resp.ok) {
            return ApiResponse.internalError('获取媒体文件失败');
        }
        return new Response(resp.body, {
            headers: {
                'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
                'Content-Disposition': resp.headers.get('Content-Disposition') || '',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (error) {
        await getLogger(env).error('wechat-api', `获取媒体文件失败: ${error.message}`);
        return ApiResponse.internalError('获取媒体文件失败', { error: error.message });
    }
}

export async function handleKFSendWelcomeMsg(request, env) {
    try {
        const body = await request.json();
        if (!body.code) {
            return ApiResponse.badRequest('缺少参数 code');
        }
        const kf = createKFRouter(env);
        const result = await kf.sendWelcomeMsg(body.code, body.msgtype, body);
        return ApiResponse.success(result, '欢迎语发送成功');
    } catch (error) {
        await getLogger(env).error('wechat-api', `欢迎语发送失败: ${error.message}`);
        return ApiResponse.internalError('欢迎语发送失败', { error: error.message });
    }
}
